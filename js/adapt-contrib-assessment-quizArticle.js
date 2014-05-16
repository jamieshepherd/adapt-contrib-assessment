define(function(require) {

    var Adapt = require('coreJS/adapt');

    var AssessmentView = Backbone.View.extend({
        initialize: function() {
            this.listenTo(this.model, 'change:_isComplete', this.assessmentComplete);
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

        assessmentComplete: function() { 
            var isPercentageBased = this.model.get('_assessment')._isPercentageBased;
            var scoreToPass = this.model.get('_assessment')._scoreToPass;
            var score = this.getScore();
            var scoreAsPercent = this.getScoreAsPercent();
            var isPass = false;
            this.setFeedbackMessage();
            this.setAssociatedLearning();
            this.model.set({
                'feedbackTitle': this.model.get('_assessment')._completionMessage.title, 
                'score': isPercentageBased ? scoreAsPercent + '%' : score
            });

            if (isPercentageBased) {
                isPass = (scoreAsPercent >= scoreToPass) ? true : false; 
            } else {
                isPass = (score >= scoreToPass) ? true : false;
            }

            Adapt.trigger('assessment:complete', {
                isPass: isPass,
                score: score,
                scoreAsPercent: scoreAsPercent,
                feedbackMessage: this.model.get('feedbackMessage'),
                associatedLearning: this.model.get('_associatedLearning')
            });
        },

        setFeedbackMessage: function() {
            var feedback = (this.model.get('_assessment')._completionMessage.message);

            feedback = feedback.replace("[SCORE]", this.getScore());
            feedback = feedback.replace("[MAXSCORE]", this.getMaxScore().toString());
            feedback = feedback.replace("[PERCENT]", this.getScoreAsPercent().toString());
            feedback = feedback.replace("[FEEDBACK]", this.getBandedFeedback().toString());

            this.model.set('feedbackMessage', feedback);
        },

        setAssociatedLearning: function() {
            var associatedLearning = [];

            _.each(this.getQuestionComponents(), function(component) {
                if (component.has('_associatedLearning')) {
                    var associatedLearningIDs = component.get('_associatedLearning');
                    
                    if (component.get('_isComplete') && !component.get('_isCorrect') && associatedLearningIDs.length > 0) {                    
                        _.each(associatedLearningIDs, function(id) {
                            var model = this.model.findByID(id);

                            if (model && model.has('title')) {
                                var title = model.get('title');

                                if (!_.contains(associatedLearning, title)) {
                                   associatedLearning.push(title);
                                }
                            }
                        }, this);
                    }
                }
            }, this);
           
            this.model.set('_associatedLearning', associatedLearning);
        },

        setUpQuiz: function() {
            this.model.get('_assessment').score = 0;

            _.each(this.getQuestionComponents(), function(component) {
                component.set({'_isEnabledOnRevisit': false, '_canShowFeedback': false}, {pluginName: "_assessment"});
            });
        },
        
        getScore: function() {
            var score = 0;

            _.each(this.getQuestionComponents(), function(component) {
                if (component.get('_isCorrect') && component.get('_score')) {
                    score += component.get('_score');   
                }
            });

            return score;
        },
        
        getMaxScore: function() {
            var maxScore = 0;

            _.each(this.getQuestionComponents(), function(component) {
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
            var bands = this.model.get('_assessment')._bands;
            var percent = this.getScoreAsPercent();
            
            for (var i = (bands.length - 1); i >= 0; i--) {
                if (percent >= bands[i]._score) {
                    return bands[i].feedback;
                }
            }
        },

        removeAssessment: function() {
            this.remove();
        }
        
    });

    Adapt.on('articleView:postRender', function(view) {
        if (view.model.get('_assessment')) {
            new AssessmentView({model:view.model});
        }
    });

});