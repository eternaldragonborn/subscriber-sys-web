const { DateTime } = require('luxon');
const webhooks =
    process.env.DEBUG_MODE ?
        ['928905146849689641'] : //for test
        [
            '923607751828062208',  //record
            '923517538967646259'   //notification
        ];

const book_webhooks =
    process.env.DEBUG_MODE ?
        {subscriber: '928905146849689641', free: '928905146849689641'} :
        {subscriber: '944470820900708402', free: '928905146849689641'};

module.exports = {
    webhooks,
    book_webhooks,
    guilds: {
        furry: '669934356172636199',
        test: '719132687897591808'
    },
    getTime: () => DateTime.now().setZone('Asia/Taipei')
}