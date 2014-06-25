define(function(require) {

	var Adapt = require('coreJS/adapt');
	var Backbone = require('backbone');
	var AssessmentView = require('extensions/adapt-contrib-assessment/js/adapt-contrib-assessment-view');
	var AssessmentModel = require('extensions/adapt-contrib-assessment/js/adapt-contrib-assessment-model');

	function initQuizData(articleModel) {
		console.log("assessment, initQuizData: " + articleModel.get('_id'));

		/*for(var prop in articleModel.get('_assessment')) {
			console.log(prop + " - " + articleModel.get('_assessment')[prop]);
		}*/

		var assessmentModel = new AssessmentModel(articleModel.get('_assessment'));
		assessmentModel.set('_children', articleModel.getChildren());
		assessmentModel.set('_allChildModels', articleModel.getChildren().models);
		// GM - can this be moved to _assessment object?
		assessmentModel.set('_canShowFeedback', articleModel.get('_canShowFeedback'));

		articleModel.set({assessmentModel:assessmentModel});
		articleModel.getChildren().models = assessmentModel.setQuizData();

		console.log("articleModel.getChildren().models.length: " + articleModel.getChildren().models.length);
		_.each(articleModel.getChildren().models, function(block){
			console.log(block.get('_id') +  " - " + block.get('_quizBankID'));
		});

		articleModel.get('assessmentModel').on('assessment:complete', function(data){
			console.log("hey I'm article assessment " + this.get('_id') + " and I've just been completed. I should reset my data if _isEnabledOnRevisit: " + this.get('_isEnabledOnRevisit'));
			console.log("complete in session?: " + this.get('_quizCompleteInSession') + ", is reset on revsit: "+ this.get('_isResetOnRevisit'));
			articleModel.getChildren().models = assessmentModel.setQuizData();
		});
	}

	Adapt.on('articleView:preRender', function(view) {
		console.log("on article preRender: ",view.model);
		if (view.model.get('_assessment')) {
			//view.model.resetQuizData();
            new AssessmentView({model:view.model});
        }
    });	

	Adapt.once('app:dataReady', function() {
		console.log("assessment.js, on data ready : " + Adapt.articles.length);
		// assume there can be more than 1 assessment article
		var assessmentArticles;

		/*_.each(Adapt.articles.models, function(article){
			console.log(article.get('_id') + " - " + article.get('_assessment'));
		});*/


		assessmentArticles = _.filter(Adapt.articles.models, function(article) {
            return article.get('_assessment');    
        });

        _.each(assessmentArticles, function(article) {
        	initQuizData(article);
        });
	});

})