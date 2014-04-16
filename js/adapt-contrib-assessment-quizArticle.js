define(function(require) {

    var Adapt = require('coreJS/adapt');

    var AssessmentView = Backbone.View.extend({
        initialize: function() {
            this.listenTo(this.model, 'change:_isComplete', this.onIsCompleteChanged);
            this.listenTo(Adapt, 'remove', this.removeAssessment);
            this.setUpQuiz();
        },

        getQuestionComponents: function() {
            var childComponents = this.model.findDescendants('components');

            // Although we retrieve all decendants of the article, regarding the assessment
            // we are only interested in questions.  Currently we check for a
            // _questionWeight attribute
            return _.filter(childComponents.models, function(component) { 
                if (component.get('_questionWeight')) {
                    return component;
                } 
            });
        },

        onIsCompleteChanged: function() { 
            function notComplete(model) {
                return !model.get('_isComplete');
            }

            if(notComplete(this.model) || _.some(this.questionComponents, notComplete)) return;
            
            var isPercentageBased = this._assessment._isPercentageBased;
            var scoreToPass = this._assessment._scoreToPass;
            var score = this.getScore();
            var scoreAsPercent = this.getScoreAsPercent();
            var isPass = false;

            Adapt.trigger('questionView:showFeedback', 
                {
                    title: this._assessment._completionMessage.title,
                    message: this.getFeedbackMessage(),
                    score: isPercentageBased ? scoreAsPercent + '%' : score
                }
            );

            if (isPercentageBased) {
                isPass = (scoreAsPercent >= scoreToPass) ? true : false; 
            } else {
                isPass = (score >= scoreToPass) ? true : false;
            }

            Adapt.trigger('assessment:complete', {isPass: isPass, score: score, scoreAsPercent: scoreAsPercent});
        },

        getFeedbackMessage: function() {
            var feedback = (this._assessment._completionMessage.message);

            feedback = feedback.replace("[SCORE]", this.getScore());
            feedback = feedback.replace("[MAXSCORE]", this.getMaxScore().toString());
            feedback = feedback.replace("[PERCENT]", this.getScoreAsPercent().toString());
            feedback = feedback.replace("[FEEDBACK]", this.getBandedFeedback().toString());

            return feedback;
        },

        setUpQuiz: function() {
            this._assessment = this.model.get('_assessment');
            this._assessment.score = 0;
            this.showFeedback = false;
            this.questionComponents = this.getQuestionComponents();
            Adapt.mediator.on('questionView:feedback', _.bind(function(event) {
                if (this.showFeedback) {
                    return;
                }
                event.preventDefault();
            }, this));

            _.each(this.questionComponents, function(component) {
                component.set('_isEnabledOnRevisit', false);
            });

            if(this._assessment._randomisation && this._assessment._randomisation._isActive) {
                this.setupRandomisation();
            }
        },

        setupRandomisation: function() {
            var randomisationModel = this._assessment._randomisation;
            var blockModels = this.model.get('_children').models;
            var startModels = blockModels.slice(0, randomisationModel._startBlockCount);
            var numberOfQuestions = blockModels.length - randomisationModel._endBlockCount;
            var questionModels = _.shuffle(blockModels.slice(randomisationModel._startBlockCount, numberOfQuestions));
            var endModels = blockModels.slice(numberOfQuestions);
            var randomCount = this.validateRandomCount(randomisationModel._randomCount, numberOfQuestions) ? this._assessment._randomCount : numberOfQuestions;

            questionModels = questionModels.slice(0, randomCount);

            this.model.get('_children').models = startModels.concat(questionModels).concat(endModels);
        },
        
        validateRandomCount: function(randomCount, numberOfQuestions) {
            return (randomCount !== undefined && _.isNumber(randomCount) && randomCount > 0 && randomCount < numberOfQuestions);
        },

        getScore: function() {
            var score = 0;

            _.each(this.questionComponents, function(component) {
                if (component.get('_isCorrect') && component.get('_score')) {
                    score += component.get('_score');   
                }
            });

            return score;
        },
        
        getMaxScore: function() {
            var maxScore = 0;

            _.each(this.questionComponents, function(component) {
                if (component.get('_questionWeight')) {
                    maxScore += component.get('_questionWeight');
                }
            });

            return maxScore;
        },
        
        getScoreAsPercent: function() {
            return Math.round((this.getScore() / this.getMaxScore()) * 100);
        },    
        
        resetQuiz: function() {
            this.model.set('_assessment').numberOfAnsweredQuestions = 0;
            this.model.set('_assessment').score = 0;
        },
        
        getBandedFeedback: function() {
            var bands = this._assessment._bands;
            var percent = this.getScoreAsPercent();
            
            for (var i = (bands.length - 1); i >= 0; i--) {
                if (percent >= bands[i]._score) {
                    return bands[i].feedback;
                }
            }
        },

        removeAssessment: function() {
            this.showFeedback = true;
            this.remove();
        }
        
    });

    Adapt.on('articleView:postRender', function(view) {
        if (view.model.get('_assessment')) {
            new AssessmentView({model:view.model});
        }
    });

});