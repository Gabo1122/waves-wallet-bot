var WavesAPI = require('./waves-api');
const Waves = WavesAPI.create(WavesAPI.MAINNET_CONFIG);

const Telegraf = require('telegraf');
const Composer = require('telegraf/composer');
const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');
const WizardScene = require('telegraf/scenes/wizard');
const Scene = require('telegraf/scenes/base');
const { enter, leave } = Stage;

const CONFIG = {
	bot_token: '',
	database_url: '',
	admin_id: ''
};

const bot = new Telegraf(CONFIG.bot_token);

const mongoose = require('mongoose');
mongoose.connect(CONFIG.database_url, {
	useNewUrlParser: true
});
let db = mongoose.connection;
db.on('error', function() {
    console.log('Error connection to MongoDB');
});
db.once('open', function() {
    console.log('Successfuly connection to MongoDB');
});

let users_schema = mongoose.Schema({
    telegram_id: { type: Number, required: true },
    waves_address: { type: String, required: true },
    waves_phrase: { type: String, required: true },
    bot_lang: { type: String, required: true },
});

let Users = mongoose.model('Users', users_schema);

function parseBotDataText (data) {
	if (data.message !== undefined) {
		return data.message.text;
    } else if (data.update.callback_query !== undefined) {
    	return data.update.callback_query.message.text;
    } else if (data.update.message !== undefined) {
    	return data.update.message.text;
    }	
}

function parseBotDataFrom (data) {
	if (data.message !== undefined) {
		return data.message.from;
    } else if (data.update.callback_query !== undefined) {
    	return data.update.callback_query.from;
    } else if (data.update.message !== undefined) {
    	return data.update.message.from;
    }
}

function default_response (ctx, text, isMarkdown) {
	if (isMarkdown) {
		return ctx.replyWithMarkdown(text, Markup.keyboard([
			['Send', 'Receive'],
			['Wallet', 'Settings']
			]).oneTime().resize().extra());
	} else {
		return ctx.reply(text, Markup.keyboard([
			['Send', 'Receive'],
			['Wallet', 'Settings']
			]).oneTime().resize().extra());
	}
}

bot.start((ctx) => {
	new Promise (function(resolve, reject) {
		let botDataFrom = parseBotDataFrom(ctx);
		Users.find({telegram_id: botDataFrom.id})
		.exec()
		.then(mongo_result => {
			if (mongo_result.length === 0) {
				return ctx.reply('Welcome! Please shoose language', Markup.inlineKeyboard([
					Markup.callbackButton('🇺🇸 English', 'select_eng_lang'),
					Markup.callbackButton('🇷🇺 Русский', 'select_rus_lang')
					]).extra());
			} else {
				return default_response(ctx, `Бот не понял тебя`, false);
			}
		})
		.catch(mongo_error => {
			bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
			return default_response(ctx, `Bot error`, false);
		});
	})
	.catch ((error) => {
        bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
		return default_response(ctx, `Bot error`, false);
    });
});

bot.action('select_eng_lang', (ctx, next) => {
	new Promise (function(resolve, reject) {
		ctx.reply('English is selected');

		let botDataFrom = parseBotDataFrom(ctx);
		const seed = Waves.Seed.create();

		const newUser = new Users({
			_id: new mongoose.Types.ObjectId(),
			telegram_id: Number(botDataFrom.id),
			waves_address: seed.address,
		    waves_phrase: seed.phrase,
		    waves_privatekey: seed.keyPair.privateKey,
		    waves_publickey: seed.keyPair.publicKey,
		    bot_lang: 'en'
		});
		newUser
		.save()
		.then(mongo_create_new_user => {
			return default_response(ctx, `Welcome!`, false);
		})
		.catch(mongo_error => {
			bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR WHEN CREATED NEW USER!');
			return default_response(ctx, `Bot error`, false);
		});
	})
	.catch ((error) => {
        bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
		return default_response(ctx, `Bot error`, false);
    });
});

bot.action('select_rus_lang', (ctx, next) => {
	new Promise (function(resolve, reject) {
		ctx.reply('Выбран русский язык');

		let botDataFrom = parseBotDataFrom(ctx);
		const seed = Waves.Seed.create();

		const newUser = new Users({
			_id: new mongoose.Types.ObjectId(),
			telegram_id: Number(botDataFrom.id),
			waves_address: seed.address,
		    waves_phrase: seed.phrase,
		    waves_privatekey: seed.keyPair.privateKey,
		    waves_publickey: seed.keyPair.publicKey,
		    bot_lang: 'ru'
		});
		newUser
		.save()
		.then(mongo_create_new_user => {
			return default_response(ctx, `Добро пожаловать!`, false);
		})
		.catch(mongo_error => {
			bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR WHEN CREATED NEW USER!');
			return default_response(ctx, `Bot error`, false);
		});
	})
	.catch ((error) => {
        bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
		return default_response(ctx, `Bot error`, false);
    });
});

bot.hears('Send', (ctx, next) => {
	new Promise (function(resolve, reject) {
		return default_response(ctx, `This page is currently unavailable`, false);
	})
	.catch ((error) => {
        bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
		return default_response(ctx, `Bot error`, false);
    });
});

bot.hears('Receive', (ctx, next) => {
	new Promise (function(resolve, reject) {
		let botDataFrom = parseBotDataFrom(ctx);
		Users.find({telegram_id: botDataFrom.id})
		.exec()
		.then(mongo_result => {
			return default_response(ctx, `*${mongo_result[0].waves_address}*`, true);
		})
		.catch(mongo_error => {
			bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
			return default_response(ctx, `Bot error`, false);
		});	
	})
	.catch ((error) => {
        bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
		return default_response(ctx, `Bot error`, false);
    });
});

bot.hears('Wallet', (ctx, next) => {
	new Promise (function(resolve, reject) {
		let botDataFrom = parseBotDataFrom(ctx);
		Users.find({telegram_id: botDataFrom.id})
		.exec()
		.then(mongo_result => {
			Waves.API.Node.addresses.balance(mongo_result[0].waves_address).then((waves_result) => {
				let waves_balance = Number(waves_result.balance/100000000);
				return default_response(ctx, `*${waves_balance} WAVES*`, true);
				// return ctx.replyWithMarkdown(`*${waves_balance} WAVES*`, Markup.inlineKeyboard([
				// 	Markup.callbackButton('Show tokens amount', 'show_tokens'),
				// 	]).extra())
			});
		})
		.catch(mongo_error => {
			bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
			return default_response(ctx, `Bot error`, false);
		});	
	})
	.catch ((error) => {
        bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
		return default_response(ctx, `Bot error`, false);
    });
});

bot.hears('Settings', (ctx, next) => {
	new Promise (function(resolve, reject) {
		return default_response(ctx, `This page is currently unavailable`, false);
	})
	.catch ((error) => {
        bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
		return default_response(ctx, `Bot error`, false);
    });
});

// bot.action('show_tokens', (ctx, next) => {
// 	new Promise (function(resolve, reject) {
// 		let botDataFrom = parseBotDataFrom(ctx);
// 		Users.find({telegram_id: botDataFrom.id})
// 		.exec()
// 		.then(mongo_result => {
// 			Waves.API.Node.assets.balances(mongo_result[0].waves_address).then((waves_result) => {
// 				return default_response(ctx, `There are *${waves_result.balances.length} tokens* on your wallet`, true);
// 			});
// 		})
// 		.catch(mongo_error => {
// 			bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
// 			return default_response(ctx, `Bot error`, false);
// 		});	
// 	})
// 	.catch ((error) => {
//         bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
// 		return default_response(ctx, `Bot error`, false);
//     });
// });

bot.on('text', (ctx, next) => {
	new Promise (function(resolve, reject) {
		let botDataFrom = parseBotDataFrom(ctx);
		Users.find({telegram_id: botDataFrom.id})
		.exec()
		.then(mongo_result => {
			if (mongo_result.length === 0) {
				return ctx.reply('Welcome! Please shoose language', Markup.inlineKeyboard([
					Markup.callbackButton('🇺🇸 English', 'select_eng_lang'),
					Markup.callbackButton('🇷🇺 Русский', 'select_rus_lang')
					]).extra());
			} else {
				return default_response(ctx, `Бот не понял тебя`, false);
			}
		})
		.catch(mongo_error => {
			bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
			return default_response(ctx, `Bot error`, false);
		});
	})
	.catch ((error) => {
        bot.telegram.sendMessage(CONFIG.admin_id, 'BOT ERROR!');
		return default_response(ctx, `Bot error`, false);
    });
});

bot.startPolling();