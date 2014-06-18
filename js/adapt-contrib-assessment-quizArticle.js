define(function(require) {

    var Adapt = require('coreJS/adapt');
    var QuestionBank = require('extensions/adapt-contrib-assessment/js/QuestionBank');

    var AssessmentView = Backbone.View.extend({
        initialize: function() {
            this.listenTo(Adapt, 'questionView:complete', this.onQuestionComplete)
            this.listenTo(Adapt, 'remove', this.removeAssessment);
            // reset models to full complement
            if(!this.model.get('allBlockModels')) this.model.set('allBlockModels', this.model.getChildren().models)
            // only if we're resetting and re-enabling the quiz
            if(this.model.get('_isEnabledOnRevisit') || !this.model.get('_assessmentCompleteInSession')) this.model.getChildren().models = this.model.get('allBlockModels');

            this.setUpQuiz();
        },

        getAllChildComponents: function() {
            var blocks = this.model.get('_children').models;
            var allChildComponents = [];
               
            _.each(blocks, function(block){
               allChildComponents = allChildComponents.concat(block.getChildren().models);
            });

            return allChildComponents;
        },

        getQuestionComponents: function() {            
                    
            // Although we retrieve all decendants of the article, regarding the assessment
            // we are only interested in questions. Currently we check for a
            // _questionWeight attribute
            return _.filter(this.allChildComponents, function(componentModel) { 
                if (componentModel.get('_isQuestionType')) return componentModel; 
            });
        },

        onQuestionComplete: function() {
            //console.log("AssessmentView,onQuestionComplete");
            this.numberOfQuestionsAnswered++;
            if(this.numberOfQuestionsAnswered >= this.questionComponents.length) {
                this.onQuizComplete();
            }    
        },            

        onQuizComplete: function() { 
         
            function notComplete(model) {
                return !model.get('_isComplete');
            }

            if(_.some(this.questionComponents, notComplete)) return;
            
            var isPercentageBased = this._assessment._isPercentageBased;
            var scoreToPass = this._assessment._scoreToPass;
            var score = this.getScore();
            var scoreAsPercent = this.getScoreAsPercent();
            var isPass = false;

            this.setFeedbackMessage();
            if(this.getFeedbackBand()._showAssociatedLearning) this.setAssociatedLearning();
            
            this.model.set({
                'feedbackTitle': this.model.get('_assessment')._completionMessage.title, 
                'score': isPercentageBased ? scoreAsPercent + '%' : score
            });

            if (isPercentageBased) isPass = (scoreAsPercent >= scoreToPass) ? true : false; 
            else isPass = (score >= scoreToPass) ? true : false;

            Adapt.trigger('assessment:complete', {
                isPass: isPass,
                score: score,
                scoreAsPercent: scoreAsPercent,
                feedbackMessage: this.model.get('feedbackMessage'),
                associatedLearning: this.model.get('_associatedLearning')
            });

            if(!this.model.get('_assessmentCompleteInSession')) this.model.set({_assessmentCompleteInSession: true});
        },

        setFeedbackMessage: function() {
            var feedback = (this.model.get('_assessment')._completionMessage.message);

            feedback = feedback.replace("[SCORE]", this.getScore());
            feedback = feedback.replace("[MAXSCORE]", this.getMaxScore().toString());
            feedback = feedback.replace("[PERCENT]", this.getScoreAsPercent().toString());
            feedback = feedback.replace("[FEEDBACK]", this.getFeedbackBand().feedback.toString());
            
            this.model.set('feedbackMessage', feedback);
        },

        setAssociatedLearning: function() {
            var associatedLearning = [];

            _.each(this.questionComponents, function(component) {
                if (component.has('_associatedLearning')) {
                    var associatedLearningIDs = component.get('_associatedLearning');
                    
                    console.log("associatedLearningIDs.length: " + associatedLearningIDs.length);
                    if (component.get('_isComplete') && !component.get('_isCorrect') && associatedLearningIDs.length > 0) {                    
                        _.each(associatedLearningIDs, function(id) {
                            var model = this.model.findByID(id);

                            if (model && model.has('title')) {
                                var title = model.get('title');

                                if (!_.contains(associatedLearning, title)) {
                                   associatedLearning.push({id: id, type: model._siblings, title: title});
                                }
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
            this.questionBanks = [];
            this.allQuestionBlocks = [];
            this.numberOfQuestionsAnswered = 0;
            
            // default values are 0 start blocks, 1 end block (results screen)
            this.startBlockCount = (_.isNumber(this._assessment._startBlockCount)) ? this._assessment._startBlockCount : 0;
            this.endBlockCount = (_.isNumber(this._assessment._endBlockCount)) ? this._assessment._endBlockCount : 1;

            if(this.model.get('_assessmentCompleteInSession')  && !this.model.get('_isEnabledOnRevisit')){
                // leave the order as before - previous answers and results will be displayed
            }
            else if(this._assessment._banks && this._assessment._banks._isEnabled && this._assessment._banks._split.length > 1){
                var banks = this._assessment._banks._split.split(",");
                           
                _.each(banks, _.bind(function(bank, index){
                    this.questionBanks.push(new QuestionBank((index+1), bank));  
                },this));

                /*console.log("this.model.getChildren().length: " + this.model.getChildren().length);
                console.log("this.model.getChildren().models.length: " + this.model.getChildren().models.length);
                console.log("this.model.get('_children').models.length: " + this.model.get('_children').models.length);*/

                this.allQuestionBlocks = this.model.getChildren().slice(this.startBlockCount, this.model.getChildren().length - this.endBlockCount);

                //debug
               /* console.log("this.allQuestionBlocks.length: " + this.allQuestionBlocks.length);
                _.each(this.allQuestionBlocks, function(block){
                    console.log("question block id " + block.get('_id'));
                })*/

                this.setAllBlocksUnavailable();
                this.populateQuestionBanks();
                this.buildBankedQuiz();
                this.setAvailableBlocks();
            }
            else if(this._assessment._randomisation && this._assessment._randomisation._isEnabled) {
                this.setAllBlocksUnavailable();
                this.setupRandomisation();
                this.setAvailableBlocks();
            }

            /*var maxScore = 0;
           _.each(this.model.findDescendants('components').models, function(component){
                if(component.get('_component') != "results") {
                    console.log(component.get('_id') + " - " + component.get('_questionWeight'));
                    maxScore += component.get('_questionWeight');
                }
           })
           console.log("maxScore: " + maxScore);*/

            this.allChildComponents = this.getAllChildComponents();
            this.questionComponents = this.getQuestionComponents();
            this.overrideLockedAttributes();
        },

        setAllBlocksUnavailable: function() {
            //console.log("quizArticle, setAllBlocksUnavailable " +this.model.getChildren().models.length);
            _.each(this.model.getChildren().models, function(block){
                block.set('_isAvailable', false, {pluginName: '_assessment'});
            });
        },

        setAvailableBlocks: function() {
             //console.log("quizArticle, setAvailableBlocks " + this.model.get('_children').models.length);
             _.each(this.model.get('_children').models, function(block){
                block.set('_isAvailable', true, {pluginName: '_assessment'});                
             })
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
            _.each(this.questionComponents, _.bind(function(component) {
                component.set({
                    '_isEnabledOnRevisit': this.model.get('_isEnabledOnRevisit') || (!this.model.get('_assessmentCompleteInSession')),
                    '_canShowFeedback': this.model.get('_canShowFeedback')
                }, { pluginName: "_assessment" });
            }, this));


            var blocks = this.model.get('_children').models;
            var childComponentModels = [];
                       
            _.each(blocks, function(block){
               childComponentModels = childComponentModels.concat(block.getChildren().models);
            }); 

            var componentsCollection = new Backbone.Collection(this.allChildComponents);
            var results = componentsCollection.findWhere({_component: "results"});
            if(results) results.set({'_isEnabledOnRevisit': this.model.get('_isEnabledOnRevisit')}, {pluginName:"_assessment"});
        },

        setupRandomisation: function() {
            //console.log("quizArticle:setupRandomisation");

            var randomisationModel = this._assessment._randomisation;
            var blockModels = this.model.get('_children').models;

            console.log("debug b4 randomisation....");
             _.each(blockModels, function(blockModel){
                //console.log(blockModel.get("_parentId") + " - " + blockModel.get('_id'));
                var components = blockModel.get('_children').models;
                _.each(components, function(component){
                    console.log(component.get("_parentId") + " - " + blockModel.get('_quizBankID') + " - " + component.get('_id') + " - " + component.get("title"));
                })
            })

            var startModels = blockModels.slice(0, this.startBlockCount);
            var numberOfQuestionBlocks = blockModels.length - this.endBlockCount;
            var questionModels = _.shuffle(blockModels.slice(this.startBlockCount, numberOfQuestionBlocks));
            var endModels = blockModels.slice(numberOfQuestionBlocks);
            var randomCount = this.validateRandomCount(randomisationModel._blockCount, numberOfQuestionBlocks) ? randomisationModel._blockCount : numberOfQuestionBlocks;

            questionModels = questionModels.slice(0, randomCount);

            console.log("debug after randomisation....");
             _.each(questionModels, function(questionModel){
                //console.log(questionModel.get("_parentId") + " - " + questionModel.get('_id'));
                 var components = questionModel.get('_children').models;
                _.each(components, function(component){
                    console.log(component.get("_parentId") + " - " + component.get('_id') + " - " + component.get("title"));
                })
            })

            this.model.get('_children').models = startModels.concat(questionModels).concat(endModels);
            this.triggerPageUpdated();
        },

        buildBankedQuiz: function() {
            var models = this.model.get('_children').models;
            var startModels = models.slice(0, this.startBlockCount);
            var endModels = models.slice(models.length-this.endBlockCount); 
            var questionModels = [];
             
            _.each(this.questionBanks, function(questionBank){
                //console.log("questionBank: " + questionBank.getID());
                var questions = questionBank.getRandomQuestionBlocks();
                questionModels = questionModels.concat(questions);
            })
          
            if(this._assessment._randomisation && this._assessment._randomisation._isEnabled) questionModels = _.shuffle(questionModels);
            var bankedModels = startModels.concat(questionModels).concat(endModels);
            
            //console.log("quizArticle.js,buildBankedQuiz setting models")
            this.model.get('_children').models = bankedModels;
                       
            this.triggerPageUpdated();
        },

        triggerPageUpdated: function() {
            var currentPage = this.model.findAncestor('contentObjects');
            Adapt.trigger('adapt:modelUpdated', currentPage);
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
        
        getFeedbackBand: function() {
            var bands = this._assessment._bands;
            var percent = this.getScoreAsPercent();
            
            for (var i = (bands.length - 1); i >= 0; i--) {
                if (percent >= bands[i]._score) return bands[i];
            }
        },

        removeAssessment: function() {
            this.remove();
        }
        
    });

    /*Adapt.on('articleView:preRender', function(view) {
        if (view.model.get('_assessment')) {
            new AssessmentView({model:view.model});
        }
    });*/

});