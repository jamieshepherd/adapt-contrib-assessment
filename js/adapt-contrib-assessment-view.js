define(function(require) {

	var Adapt = require('coreJS/adapt');
    	
	var AssessmentView = Backbone.View.extend({

		initialize: function() {
			console.log("AssessmentView, initialize",this.model);
			this.model.get('assessmentModel').resetQuizData();
		},

	})

	return AssessmentView;

});