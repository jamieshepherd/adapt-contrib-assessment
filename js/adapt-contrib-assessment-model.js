define(function(require) {

	var Backbone = require('backbone');
	var Adapt = require('coreJS/adapt');
	var QuestionBank = require('extensions/adapt-contrib-assessment/js/adapt-contrib-assessment-QuestionBank');

	var AssessmentModel = Backbone.Model.extend({

		className: "AssessmentModel",

		initialize: function() {
			console.log("AssessmentModel, initialize");
			this.listenTo(Adapt, 'questionView:complete', this.onQuestionComplete);
		},

		setQuizData: function() {
			console.log(this.className +":setQuizData");
			this.questionBanks = [];
            this.allQuestionBlocks = [];
            this.numberOfQuestionsAnswered = 0;
            this.get('_children').models = this.get('_allChildModels');
            var quizModels;

            // default values are 0 start blocks, 1 end block (results screen)
            this.startBlockCount = (_.isNumber(this.get('_startBlockCount'))) ? this.get('_startBlockCount') : 0;
            this.endBlockCount = (_.isNumber(this.get('_endBlockCount'))) ? this.get('_endBlockCount') : 1;
            this.allQuestionBlocks = this.get('_children').slice(this.startBlockCount, this.get('_children').length - this.endBlockCount);
                
            console.log("this.allQuestionBlocks.length " + this.allQuestionBlocks.length);
            console.log("child blocks length: " + this.get('_children').models.length);


            _.each(this.get('_children').models, function(block){
                console.log("assessment child block: " + block.get('_id'));
            })

            console.log("quiz complete in session: " + this.get('_quizCompleteInSession'));
            console.log("reset on revisit: " + this.get('_isResetOnRevisit'));
            if(this.get('_quizCompleteInSession')  && !this.get('_isResetOnRevisit')){
                // leave the order as before - previous answers and results will be displayed
                quizModels = this.get('quizModels');
            }
            else if(this.get('_banks') && this.get('_banks')._isEnabled && this.get('_banks')._split.length > 1){
                var banks = this.get('_banks')._split.split(",");
                           
                _.each(banks, _.bind(function(bank, index){
                    this.questionBanks.push(new QuestionBank((index+1), bank));  
                },this));

                //debug
                /*console.log("this.allQuestionBlocks.length: " + this.allQuestionBlocks.length);
                _.each(this.allQuestionBlocks, function(block){
                    console.log("question block id " + block.get('_id'));
                })*/

                this.setAllBlocksUnavailable();
               	this.populateQuestionBanks();
                quizModels = this.buildBankedQuiz();
                this.setAvailableBlocks();
            }
            else if(this.get('_randomisation') && this.get('_randomisation')._isEnabled) {
                this.setAllBlocksUnavailable();
                quizModels = this.setupRandomisation();
                this.setAvailableBlocks();
            }
            else {
            	quizModels = this.get('_children').models;
            }

            console.log("quizModels.length: " + quizModels.length);
            this.set({quizModels:quizModels});
            this.allChildComponents = this.getAllChildComponents();
            this.questionComponents = this.getQuestionComponents();
            this.overrideLockedAttributes();

            return quizModels;
		},

		buildBankedQuiz: function() {
            var models = this.get('_children').models;
            var startModels = models.slice(0, this.startBlockCount);
            var endModels = models.slice(models.length-this.endBlockCount); 
            var questionModels = [];
            var bankedModels;
             
            _.each(this.questionBanks, function(questionBank){
                //console.log("questionBank: " + questionBank.getID());
                var questions = questionBank.getRandomQuestionBlocks();
                questionModels = questionModels.concat(questions);
            })
          
            if(this.get('_randomisation') && this.get('_randomisation')._isEnabled) questionModels = _.shuffle(questionModels);
            bankedModels = startModels.concat(questionModels).concat(endModels);

            console.log("debug after banks sorted....");
             _.each(questionModels, function(questionModel){
                console.log(questionModel.get("_parentId") + " - " + questionModel.get('_id'));
                 /*var components = questionModel.get('_children').models;
                _.each(components, function(component){
                    console.log(component.get("_parentId") + " - " + component.get('_id') + " - " + component.get("title"));
                })*/
            });
            
            return bankedModels;
        },

         setupRandomisation: function() {
            console.log(this.className + ":setupRandomisation");

            var randomisationModel = this.get('_randomisation');
            var blockModels = this.get('_children').models;
            var bankedModels;

            /*console.log("debug b4 randomisation....");
             _.each(blockModels, function(blockModel){
                //console.log(blockModel.get("_parentId") + " - " + blockModel.get('_id'));
                var components = blockModel.get('_children').models;
                _.each(components, function(component){
                    console.log(component.get("_parentId") + " - " + blockModel.get('_quizBankID') + " - " + component.get('_id') + " - " + component.get("title"));
                })
            })*/

            var startModels = blockModels.slice(0, this.startBlockCount);
            var numberOfQuestionBlocks = blockModels.length - this.endBlockCount;
            var questionModels = _.shuffle(blockModels.slice(this.startBlockCount, numberOfQuestionBlocks));
            var endModels = blockModels.slice(numberOfQuestionBlocks);
            var randomCount = this.validateRandomCount(randomisationModel._blockCount, numberOfQuestionBlocks) ? randomisationModel._blockCount : numberOfQuestionBlocks;

            questionModels = questionModels.slice(0, randomCount);

            console.log("debug after randomisation....");
             _.each(questionModels, function(questionModel){
                console.log(questionModel.get("_parentId") + " - " + questionModel.get('_id'));
                 /*var components = questionModel.get('_children').models;
                _.each(components, function(component){
                    console.log(component.get("_parentId") + " - " + component.get('_id') + " - " + component.get("title"));
                })*/
            });

            bankedModels = startModels.concat(questionModels).concat(endModels);
            
            return bankedModels;
        },

		setAllBlocksUnavailable: function() {
            //console.log(this.className + ":setAllBlocksUnavailable " + this.get('_children').models.length);
            _.each(this.get('_children').models, function(block){
               	//console.log(block.get('_id'));
                block.set('_isAvailable', false, {pluginName: '_assessment'});
            });
        },

        setAvailableBlocks: function() {
             //console.log(this.className + ":setAvailableBlocks " + this.get('_children').models.length);
             _.each(this.get('_children').models, function(block){
                block.set('_isAvailable', true, {pluginName: '_assessment'});                
             })
        },

        overrideLockedAttributes: function() {
            _.each(this.questionComponents, _.bind(function(component) {
                component.set({
                    '_isEnabledOnRevisit': this.get('_isResetOnRevisit') || (!this.get('_quizCompleteInSession')),
                    '_canShowFeedback': this.get('_canShowFeedback')
                }, { pluginName: "_assessment" });
            }, this));

            var childComponentModels = [];
                       
            _.each(this.get('_children').models, function(block){
               childComponentModels = childComponentModels.concat(block.getChildren().models);
            }); 

            var componentsCollection = new Backbone.Collection(this.allChildComponents);
            var results = componentsCollection.findWhere({_component: "results"});
            if(results) results.set({'_isEnabledOnRevisit': this.get('_isResetOnRevisit')}, {pluginName:"_assessment"});
        },

        populateQuestionBanks: function() {        
            console.log(this.className + ":populateQuestionBanks " + this.allQuestionBlocks.length);

            _.each(this.allQuestionBlocks, _.bind(function(questionBlock){
                //console.log("questionBlock",questionBlock);
                console.log("questionBlock " + questionBlock.get('_id') + " - " + questionBlock.get('_quizBankID'));
                var bankID = questionBlock.get('_quizBankID');
                var questionBank = this.getBankByID(bankID);
                questionBank.addBlock(questionBlock); 
            }, this));
        },

        getBankByID: function(id) {
            console.log(this.className + ":getBankByID: " + id);
            for(var i=0;i<this.questionBanks.length;i++){
                var qb = this.questionBanks[i];
                if(id===qb.getID()) return qb;
            }            
        },

		onQuestionComplete: function() {
            console.log(this.className +":onQuestionComplete");
            this.numberOfQuestionsAnswered++;
           	console.log("this.numberOfQuestionsAnswered: " + this.numberOfQuestionsAnswered);
            console.log("this.questionComponents.length: " + this.questionComponents.length);
            if(this.numberOfQuestionsAnswered >= this.questionComponents.length) {
                this.onQuizComplete();
            }    
        },

        getAllChildComponents: function() {
            var allChildComponents = [];
               
            _.each(this.get('quizModels'), function(block) {
               allChildComponents = allChildComponents.concat(block.getChildren().models);
            });

            return allChildComponents;
        },

         getQuestionComponents: function() {            
            return _.filter(this.allChildComponents, function(componentModel) { 
                if (componentModel.get('_questionWeight')) return componentModel; 
            });
        },

        onQuizComplete: function() { 

        	console.log(this.className + "::onQuizComplete");
            
            var isPercentageBased = this.get('_isPercentageBased');
            var scoreToPass = this.get('_scoreToPass');
            var score = this.getScore();
            var scoreAsPercent = this.getScoreAsPercent();
            var isPass = false;

            this.setFeedbackMessage();
            if(this.getFeedbackBand()._showAssociatedLearning) this.setAssociatedLearning();
            
            this.set({
                'feedbackTitle': this.get('_completionMessage').title, 
                'score': isPercentageBased ? scoreAsPercent + '%' : score
            });

            if (isPercentageBased) isPass = (scoreAsPercent >= scoreToPass) ? true : false; 
            else isPass = (score >= scoreToPass) ? true : false;

            if(!this.get('_quizCompleteInSession')) this.set({_quizCompleteInSession: true});

            this.trigger('assessment:complete', {
                isPass: isPass,
                score: score,
                scoreAsPercent: scoreAsPercent,
                feedbackMessage: this.get('feedbackMessage'),
                associatedLearning: this.get('_associatedLearning')
            });
        },

        setFeedbackMessage: function() {
            var feedback = this.get('_completionMessage').message;

            feedback = feedback.replace("[SCORE]", this.getScore());
            feedback = feedback.replace("[MAXSCORE]", this.getMaxScore().toString());
            feedback = feedback.replace("[PERCENT]", this.getScoreAsPercent().toString());
            feedback = feedback.replace("[FEEDBACK]", this.getFeedbackBand().feedback.toString());
            
            this.set('feedbackMessage', feedback);
        },

        setAssociatedLearning: function() {
            var associatedLearning = [];

            _.each(this.questionComponents, function(component) {
                if (component.has('_associatedLearning')) {
                    var associatedLearningIDs = component.get('_associatedLearning');
                    
                    console.log("associatedLearningIDs.length: " + associatedLearningIDs.length);
                    if (component.get('_isComplete') && !component.get('_isCorrect') && associatedLearningIDs.length > 0) {                    
                        _.each(associatedLearningIDs, function(id) {
                            
                            var model = Adapt.findByID(id);

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
           
            this.set('_associatedLearning', associatedLearning);
        },

        validateRandomCount: function(randomCount, numberOfQuestions) {
        	return (randomCount !== undefined && _.isNumber(randomCount) && randomCount > 0 && randomCount < numberOfQuestions);
        },

        getScore: function() {
            var score = 0;
            _.each(this.questionComponents, function(component) {
                if (component.get('_isCorrect') && component.get('_questionWeight')) score += component.get('_questionWeight');
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
        
        resetQuizData: function() {
        	//this.set('_assessment').score = 0;
        },
        
        getFeedbackBand: function() {
            var bands = this.get('_bands');
            var percent = this.getScoreAsPercent();
            
            for (var i = (bands.length - 1); i >= 0; i--) {
                if (percent >= bands[i]._score) return bands[i];
            }
        }
	});

	return AssessmentModel;
});