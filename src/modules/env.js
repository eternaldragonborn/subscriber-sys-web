import { GuildMember, User, Webhook } from "discord.js";

const testWebhook = '928905146849689641';
/**
 * @type {{
 *  subscribe: {
 *      record: string;
 *      notification: string;
 *  },
 *  book: {
 *      subscribe: string;
 *      free: string;
 *  }
 * }}
 */
export const webhooks =
    process.env.DEBUG_MODE ? {
            subscribe: {
                // record: testWebhook,
                notification: testWebhook
            },
            book: {
                subscribe: testWebhook,
                free: testWebhook
            }
        } : {
            subscribe: {
                record: '923607751828062208',
                notification: '923517538967646259'
            },
            book: {
                subscribe: '944470820900708402',
                free: ''
            }
        };

/**
 * @param { Webhook } hook
 * @param { string } name - webhook顯示名稱
 * @param { GuildMember | User } [user]
 * @return { Promise<void> }
*/
export const hookSetting = async (hook, name, user) => {
    const defaultAvatar = 'https://i.imgur.com/nMCfG4sm.jpg';
    if(user) {
        const username = user.displayName ?? user.username ?? 'unknown';
        const ImageURLOption = { dynamic: true, format: 'jpeg'};
        const userAvatar = user.displayAvatarURL(ImageURLOption) ?? user.avatarURL(ImageURLOption) ?? defaultAvatar;
        await hook.edit({
            name: `${username}(${name})`,
            avatar: userAvatar
        });
    } else {
        await hook.edit({
            avatar: defaultAvatar,
            name: name
        });
    }
};

export const guilds =  {
    furry: '669934356172636199',
    test: '719132687897591808'
};

export const emojis = {
    book: ':076:713997954201157723'
};

export const UpdateStatus = {
    newSubscribe: 1,
    normal: 0,
    noUpdate: 2,
    unSubscribed: 3
}