const { Webhook, MessageBuilder } = require('discord-webhook-node');
const config = require('./config');
const hook = new Webhook(config.hookurl);

const embed = new MessageBuilder()
    .setTitle('Hot off the presses:')
    .setAuthor('DLUX', 'https://cdn.discordapp.com/embed/avatars/0.png', 'https://www.dlux.io')
    //.setURL('https://www.google.com')
    .addField('First field', 'this is inline', true)
    //.addField('Second field', 'this is not inline')
    .setColor('#00b0f4')
    //.setThumbnail('https://cdn.discordapp.com/embed/avatars/0.png')
    //.setDescription('Oh look a description :)')
    //.setImage('https://cdn.discordapp.com/embed/avatars/0.png')
    //.setFooter('Hey its a footer', 'https://cdn.discordapp.com/embed/avatars/0.png')
    .setTimestamp();

//hook.send(embed);

exports.contentToDiscord = (embed)

exports.postToDiscord = (msg) => {
    hook.send(msg)
}