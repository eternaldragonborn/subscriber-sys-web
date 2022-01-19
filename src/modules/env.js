const { DateTime } = require('luxon');
const webhooks =
    process.env.DEBUG_MODE ?
        ['928905146849689641'] :
        [
            '923607751828062208',
            '923517538967646259'
        ];

module.exports = {
    webhooks,
    guilds: {
        furry: '669934356172636199',
        test: '719132687897591808'
    },
    getTime: () => DateTime.now().setZone('Asia/Taipei')
}