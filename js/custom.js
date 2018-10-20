$("#survey").hide();
// 1. Add your Parse keys.
Parse.initialize("cG5ZyLZoAx5LHicfV6C0ZdRAnJSxHryRB2J0JQFV", "KV4qiFI3EY4JIjGB66VLs6Il26SWMIMb4pLDXKMR");
/*
*  We will check to see if the user is already logged in, and give options to reload characters
*  or signin / signup depending.
if(Parse.User.current()) {
    alert (Parse.User.current().name);
} else {
    alert ("login");
}
*/


function updateHead(head){
    // alert(head);
    // Commented out for final deliverable for HCI
}

function finishedPlaying(){
    $("#done-button").hide();
    $("#builder").hide();
    $("#survey").show();
    var user = Parse.User.current();
    if (user){
        $('#email').val(user.get("username"));
    }
}
function submitSurvey(){
    var user = Parse.User.current();
    if (!user){
        user = new Parse.User();
        user.set("username", $("#email").val());
        user.set("password", "password");
        user.set("email", $("#email").val());

        user.signUp(null, {
              success: function(user) {
                
              },
              error: function(user, error) {
                // Show the error message somewhere and let the user try again.
                
                //alert("Error: " + error.code + " " + error.message);
              }
        });
    }
    var Survey = Parse.Object.extend("Survey");
    var survey = new Survey();

    survey.set("surveyVersion", 1);
    survey.set("childAge", $("#child-age").val());
    survey.set("childLiked", $("#child-liked").val());
    survey.set("whatWorked", $("#what-worked").val());
    survey.set("whatsNext", $("#whats-next").val());
    survey.set("user", user);

    survey.save(null, {
      success: function(survey) {
        // Execute any logic that should take place after the object is saved.
        alert("Thanks for helping us out. Avava's launch date is right around the corner!");
        $("#builder").show();
        $("#done-button").show();
        $("#survey").hide();
      },
      error: function(survey, error) {
        // Execute any logic that should take place if the save fails.
        // error is a Parse.Error with an error code and description.
        alert("Thanks for helping us out. Avava's launch date is right around the corner!");
        $("#builder").show();
        $("#done-button").show();
        $("#survey").hide();
      }
    });
}
 