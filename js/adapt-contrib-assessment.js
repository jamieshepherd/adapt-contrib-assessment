define(function(require) {

	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');
	var AssessmentView = require('extensions/adapt-contrib-assessment/js/adapt-contrib-assessment-view');
	var AssessmentModel = require('extensions/adapt-contrib-assessment/js/adapt-contrib-assessment-model');

	function initQuizData(articleModel) {
		console.log("assessment, initQuizData: " + articleModel.get('_id'));

		if(typeof Adapt.course.get('_isAssessmentAttemptComplete') === "undefined") Adapt.course.set('_isAssessmentAttemptComplete', false);

		var assessmentModel = new AssessmentModel(articleModel.get('_assessment'));
		assessmentModel.set('_children', articleModel.getChildren());
		assessmentModel.set('_allChildModels', articleModel.getChildren().models);
		assessmentModel.set('_id', articleModel.get('_id'));
		// GM - can this be moved to _assessment object?
		assessmentModel.set('_canShowFeedback', articleModel.get('_canShowFeedback'));

		articleModel.set({assessmentModel:assessmentModel});
		articleModel.getChildren().models = assessmentModel.setQuizData();

		//console.log("articleModel.getChildren().length: " + articleModel.getChildren().length);
		//console.log("articleModel.getChildren().models.length: " + articleModel.getChildren().models.length);
		/*_.each(articleModel.getChildren().models, function(block){
			console.log(block.get('_id') +  " - " + block.get('_quizBankID'));
		});*/

		Adapt.on('assessment:complete', function() {
			console.log("adapt-contrib-assessment.js, complete");
			//console.log("articleModel",articleModel);
			//console.log("assessmentModel",assessmentModel);
			articleModel.getChildren().models = assessmentModel.setQuizData();
		});

		/*articleModel.get('assessmentModel').on('assessment:complete', function(data){
			//console.log("hey I'm article assessment " + this.get('_id') + " and I've just been completed. I should reset my data if _isResetOnRevisit: " + this.get('_isResetOnRevisit'));
			//console.log("complete in session?: " + this.get('_quizCompleteInSession') + ", is reset on revsit: "+ this.get('_isResetOnRevisit'));
			articleModel.getChildren().models = assessmentModel.setQuizData();
		});*/

		var questionSubsetUsed = articleModel.getChildren().models.length < articleModel.getChildren().length;
		console.log("questionSubsetUsed: " + questionSubsetUsed);
		if(questionSubsetUsed) {
			Adapt.blocks.on('change:_isComplete', onBlockComplete);
			Adapt.on('assessment:complete', onAssessmentComplete);
		}
	}

	function onBlockComplete(block) {
		console.log("assessment.js:onBlockComplete " + block.get('_id'));
		if(Adapt.course.get('_isAssessmentAttemptComplete') && !Adapt.course.get('_isComplete')) checkCourseCompletion();
	}

	function onAssessmentComplete() {
		console.log("assessment.js:onAssessmentComplete");
		if (!Adapt.course.get('_isComplete')) checkCourseCompletion();
	}

	function checkCourseCompletion() {
		console.log("assessment.js, checkCourseCompletion");
		// if the assessment is complete, and all non-assessment blocks are complete - then all course content has been viewed - set course to complete
		var allNonAssessmentBlocksComplete = getAllNonAssessmentBlocksComplete();
		console.log("allNonAssessmentBlocksComplete: " + allNonAssessmentBlocksComplete);
		if(allNonAssessmentBlocksComplete) Adapt.course.set('_isComplete', true);
	}

	 function getAllNonAssessmentBlocksComplete () {
	 	var allComplete = true;
      _.each(Adapt.blocks.models, function(model) {
            var isPartOfAssessment = (model.getParent().get('_assessment') != undefined);
            console.log(model.get('_id') + " - " + model.get('_isComplete') + " - " + isPartOfAssessment);
            if(!model.get('_isComplete') && !isPartOfAssessment) allComplete = false;                   
        }, this);

        return allComplete;
    }

	Adapt.on('articleView:preRender', function(view) {
		//console.log("on article preRender: ",view.model);
		if (view.model.get('_assessment')) {
			new AssessmentView({model:view.model});
        }
    });	

	Adapt.once('app:dataReady', function() {
		console.log("assessment.js, on data ready : " + Adapt.articles.length);
		// assume there can only be a single assessment
		var assessmentArticle = _.find(Adapt.articles.models, function(article) {
            return article.get('_assessment');
        });

        if(assessmentArticle != undefined) initQuizData(assessmentArticle);
	});

})