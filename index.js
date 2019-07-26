/**
 * A Bot for Slack!
 */

const https = require('https');
/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

const triviaStack = [];
let guessing = false;
let whatArray = [
    'what? ಠ_ಠ',
    'wat?',
    'wut?',
    'huh?',
];

var getWhat = function(){
    var randomNumber = Math.floor(Math.random() * whatArray.length);
    return whatArray[randomNumber];
}

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}


/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
    };
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
    process.exit(1);
}

/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});

/**
 * Core bot logic goes here!
 */
// BEGIN EDITING HERE!

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "Hey, I'm alive ＼( °□° )／")
});

controller.hears(['hello', 'hi', 'greetings', 'watsup', 'hey'],  ['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    bot.reply(message, 'Hey •_•');
});
controller.hears(['what can you do'],  ['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    bot.reply(message, 'Type Trivia and you will see ( ͡° ͜ʖ ͡°)');
});
controller.hears(['stop'],  ['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    bot.reply(message, 'no');
});
controller.hears(['please'],  ['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    bot.reply(message, 'no ಠ_ಠ');
});
controller.hears(['what are you', 'who are you'],  ['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    bot.reply(message, 'Just an awesome Trivia bot');
});

controller.hears(['why', 'are you sure?'],  ['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    bot.reply(message, getWhat());
});

controller.hears(['trivia', 'new question', 'next question', 'next'],  ['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    bot.reply(message, 'Let me think.');
    makeTrivia(bot, message);
});

controller.hears('help',  ['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    let resp = `For Trivia say: trivia. ・_・`
    bot.reply(message, resp);
});

controller.hears(['I give up', 'what', 'I dont know', 'so', 'answer', 'whats the answer','what is it', 'who is it', 'what was it?', 'who was it?'], 
['direct_mention', 'mention', 'direct_message'], function (bot, message) {
    if (!guessing) {
        bot.reply(message, getWhat());
    } else {
        setGuessing(false)
        let resp = triviaStack[triviaStack.length - 1].answer;
        bot.reply(message, 'The answer is: ' + resp);
    }
});

const setGuessing = function(guess){
    console.log(`Setting guessing: ${guess}`);
    guessing = guess;
}

const makeTrivia = async function(bot, message){
    let data = await getRandomQuestion();
    let responseMessage = '';
    if (!data) {
        responseMessage = 'Something went wrong (╯°□°）╯';
    } else {
        let json = JSON.parse(data)[0];
        if (!json || !json.id || !json.question || !json.answer) {
            console.log('Corrupted json: ', json)
            responseMessage = 'Corrupted json data (╯°□°）╯';
        } else {
            setGuessing(true)
            triviaStack.push(json);
            responseMessage = "Question: " + json.question;
        }
    }

    bot.reply(message, responseMessage);
}

const getRandomQuestion = async function() {
    return new Promise((resolve, reject) => {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        https.get('https://jservice.io/api/random', (resp) => {
        let data = '';
    
        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });
    
        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            console.log("Success");
            resolve(data);
        });
    
        }).on("error", (err) => {
            console.log("Error: " + err.message);
            reject('Failed to get: ', err.message);
        });
    });
}

/**
 * AN example of what could be:
 * Any un-handled direct mention gets a reaction and a pat response!
 */
controller.on('direct_message,mention,direct_mention', function (bot, message) {
    let imoji = '';
    if (guessing) {
        let resp = triviaStack[triviaStack.length - 1].answer;
        if (message.text == resp) {
            setGuessing(false)
            imoji = 'thumbsup';
            bot.reply(message, 'Correct °□°');
        } else {
            imoji = 'thumbsdown';
        }
    } else {
        bot.reply(message, getWhat());
    }
   bot.api.reactions.add({
       timestamp: message.ts,
       channel: message.channel,
       name: imoji,
   }, function (err) {
       if (err) {
           console.log(err)
       }
   });

});
