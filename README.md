adapt-contrib-assessment
========================

A basic assessment for the Adapt Framework which attaches to an 'article' object to group various question components (such as [adapt-contrib-mcq](https://github.com/adaptlearning/adapt-contrib-mcq), [adapt-contrib-textInput](https://github.com/adaptlearning/adapt-contrib-textInput) and [adapt-contrib-matching](https://github.com/adaptlearning/adapt-contrib-matching)) and provide a score with feedback.

A [sample JSON](https://github.com/cgkineo/adapt-contrib-assessment/blob/master/example.json) is given below which can be added to a single article block:

```json
"_assessment": {
    "_startBlockCount": 0,
    "_endBlockCount": 1,
    "_banks":{
        "_isEnabled": false,
        "_split": "1,2,1"
    },
    "_randomisation": {
        "_isEnabled": false,
        "_blockCount": 6
    },
    "_isPercentageBased" : true,
    "_scoreToPass" : 60,
    "_completionMessage" : {
        "title" : "You have finished the assessment",
        "message": "You have scored [SCORE] out of [MAXSCORE].  [FEEDBACK]"
    },
    "_bands": [
        {
            "_score": 0,
            "feedback": "You must try harder"
        },
        {
            "_score": 25,
            "feedback": "I think you can do better than this"
        },
        {
            "_score": 50,
            "feedback": "Good effort, you're getting there..."
        },
        {
            "_score": 75,
            "feedback": "Excellent!"
        }
    ]
}
```

A description of attributes is as follows:

| Attribute        | Type| Description|
| :------------ |:-------------|:-----|
| _startBlockCount  | int   | Number of blocks appear in order at the start of the quiz, before question blocks are randomised or put into banks. Typically used for showing initial presentation blocks |
| _endBlockCount    | int   | Number of blocks appear at the end of the quiz, after randomised or banked question blocks |
| _banks    |  object |  _Set "_isEnabled" (bool) to true to put question blocks into banks. "_split" (String) sets the split across banks e.g. "1,2,1" will pull 1 from bank 1, 2 from bank 2, 1 from bank 3 |
| _isPercentageBased        | bool |Set this to *true* if the assessment should work on percentages, or *false* for otherwise|
| _scoreToPass         | int      | This is the 'pass' mark for the assessment.  If _isPercentageBased is set to *true* this will be a percentage, e.g. 60 would equal 60% |
| _completionMessage            | object | An object containing *title* and *message* string values.  Note that *message* can contain the following placeholders: [SCORE], [MAXSCORE] and [FEEDBACK] |
| _bands          | object array | An array of objects whose purpose is to define the score banding.  The attributes required for each object are _score and *feedback*

###Events

<table>
    <thead>
        <td><b>Event</b></td>
        <td><b>Description</b></td>
        <td><b>Object</b></td>        
    </thead>
    <tr valign="top">
        <td><i>assessment:complete</i></td>
        <td>Triggered when the user submits the last question component which is part of the assessment article </td>
        <td>
            <table>
                <tr>
                    <td>isPass</td>
                    <td>bool</td>
                </tr>
                <tr>
                    <td>score</td>
                    <td>int</td>
                </tr>
                <tr>
                    <td>scoreAsPercent</td>
                    <td>int</td>
                </tr>
            </table>
        
        </td>        
    </tr>
</table>