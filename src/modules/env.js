const { DateTime } = require('luxon');
const webhooks = [
    '923607751828062208',
    '923517538967646259'
]

module.exports = {
    webhooks,
    getTime: () => DateTime.now().setZone('Asia/Taipei')
}