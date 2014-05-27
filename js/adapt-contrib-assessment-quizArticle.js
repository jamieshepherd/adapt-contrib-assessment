define(function(require) {

    var Adapt = require('coreJS/adapt');
    var QuestionBank = require('extensions/adapt-contrib-assessment/js/QuestionBank');

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
                if (component.get('_questionWeight')) return component; 
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

            this.setFeedbackMessage();
            this.setAssociatedLearning();
            this.model.set({
                'feedbackTitle': this.model.get('_assessment')._completionMessage.title, 
                'score': isPercentageBased ? scoreAsPercent + '%' : score
            });
            Adapt.trigger('questionView:showFeedback', this);

            if (isPercentageBased) isPass = (scoreAsPercent >= scoreToPass) ? true : false; 
            else isPass = (score >= scoreToPass) ? true : false;

            Adapt.trigger('assessment:complete', {isPass: isPass, score: score, scoreAsPercent: scoreAsPercent});
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
                                if (!_.contains(associatedLearning, title)) associatedLearning.push(title);
                            }
                        }, this);
                    }
                }
            }, this);
           
            this.model.set('_associatedLearning', associatedLearning);
        },

        setUpQuiz: function() {
            this._assessment = this.model.get('_assessment');
            this._assessment.score = 0;
            this.showFeedback = false;
            this.questionComponents = this.getQuestionComponents();
            this.questionBanks = [];
            this.allQuestionBlocks = [];
            //this.quizQuestions = [];

            // default values are 0 start blocks, 1 end block (results screen)
            this.startBlockCount = (_.isNumber(this._assessment._startBlockCount)) ? this._assessment._startBlockCount : 0;
            this.endBlockCount = (_.isNumber(this._assessment._endBlockCount)) ? this._assessment._endBlockCount : 1;

            /*Adapt.on('questionView:feedback', _.bind(function(event) {
                if (this.showFeedback) return;
                event.preventDefault();
            }, this));*/

            this.overrideLockedAttributes();

           //console.log("quizArticle:setUpQuiz: " + this._assessment);

            if(this._assessment._banks && this._assessment._banks._isActive && this._assessment._banks._split.length > 1){
                var banks = this._assessment._banks._split.split(",");
            
                _.each(banks, _.bind(function(bank, index){
                    this.questionBanks.push(new QuestionBank((index+1), bank));  
                },this));

                this.allQuestionBlocks = this.model.getChildren().slice(this.startBlockCount, this._assessment._banks._split.length - this.endBlockCount);
                            
                this.populateQuestionBanks();
                
                this.buildBankedQuiz();
            }
            else if(this._assessment._randomisation && this._assessment._randomisation._isActive) {
                this.setupRandomisation();
            }
        },

        populateQuestionBanks: function() {        
            //console.log("populateQuestionBanks " + this.allQuestionBlocks.length);

            _.each(this.allQuestionBlocks, _.bind(function(questionBlock){
                //console.log("questionBlock",questionBlock);
                var bankID = questionBlock.get('_quizBankID');
                var questionBank = this.getBankByID(bankID);
                //console.log(questionBank,questionBank);
                questionBank.addBlock(questionBlock); 
            }, this));
        },

        getBankByID: function(id) {
            //console.log("getBankByID: " + id);
            for(var i=0;i<this.questionBanks.length;i++){
                var qb = this.questionBanks[i];
                if(id===qb.getID()) return qb;
            }            
        },

        overrideLockedAttributes: function() {
            _.each(this.questionComponents, function(component) {
                component.set({
                    '_isEnabledOnRevisit': false, 
                    '_canShowFeedback': false
                }, { pluginName: "_assessment" });
            });
        },

        setupRandomisation: function() {
            console.log("quizArticle:setupRandomisation");

            var randomisationModel = this._assessment._randomisation;
            var blockModels = this.model.get('_children').models;

            console.log("b4 randomisation....");
             _.each(blockModels, function(blockModel){
                console.log(blockModel.get("_parentId") + " - " + blockModel.get('_id'));
                var components = blockModel.get('_children').models;
                _.each(components, function(component){
                    console.log(component.get("_parentId") + " - " + component.get('_id') + " - " + component.get("title"));
                })
            })

            var startModels = blockModels.slice(0, this.startBlockCount);
            var numberOfQuestions = blockModels.length - this.endBlockCount;
            var questionModels = _.shuffle(blockModels.slice(this.startBlockCount, numberOfQuestions));
            var endModels = blockModels.slice(numberOfQuestions);
            var randomCount = this.validateRandomCount(randomisationModel._randomCount, numberOfQuestions) ? this._assessment._randomCount : numberOfQuestions;

            questionModels = questionModels.slice(0, randomCount);

            console.log("after randomisation....");
             _.each(questionModels, function(questionModel){
                console.log(questionModel.get("_parentId") + " - " + questionModel.get('_id'));
                 var components = questionModel.get('_children').models;
                _.each(components, function(component){
                    console.log(component.get("_parentId") + " - " + component.get('_id') + " - " + component.get("title"));
                })
            })

            this.model.get('_children').models = startModels.concat(questionModels).concat(endModels);
        },

        buildBankedQuiz: function() {
            var models = this.model.get('_children').models;
            var startModels = models.slice(0, this.startBlockCount);
            var endModels = models.slice(models.length-this.endBlockCount); 
            var questionModels = [];
             
            _.each(this.questionBanks, function(questionBank){
                var questions = questionBank.getRandomQuestionBlocks();
                questionModels = questionModels.concat(questions);
            })
          
            if(this._assessment._randomisation && this._assessment._randomisation._isActive) questionModels = _.shuffle(questionModels);
            var bankedModels = startModels.concat(questionModels).concat(endModels);
            this.model.get('_children').models = bankedModels;
        },
        
        validateRandomCount: function(randomCount, numberOfQuestions) {
          return (randomCount !== undefined && _.isNumber(randomCount) && randomCount > 0 && randomCount < numberOfQuestions);
        },

        getScore: function() {
            var score = 0;
            _.each(this.questionComponents, function(component) {
                if (component.get('_isCorrect') && component.get('_score')) score += component.get('_score');
            });
            return score;
        },
        
        getMaxScore: function() {
            var maxScore = 0;
            _.each(this.questionComponents, function(component) {
                if (component.get('_questionWeight')) maxScore += component.get('_questionWeight');
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
                if (percent >= bands[i]._score) return bands[i].feedback;
            }
        },

        removeAssessment: function() {
            this.remove();
        }
        
    });

    Adapt.on('articleView:preRender', function(view) {
        if (view.model.get('_assessment')) {
            new AssessmentView({model:view.model});
        }
    });

});