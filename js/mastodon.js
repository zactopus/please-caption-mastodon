const {
  MASTODON_ACCESS_TOKEN,
  MASTODON_API_URL,
  MASTODON_CLIENT_KEY,
  MASTODON_CLIENT_SECRET
} = process.env

if (!MASTODON_ACCESS_TOKEN || !MASTODON_API_URL) {
  console.error('Missing environment variables from Mastodon. See README')
  process.exit(1)
}

const fs = require('fs')
const Mastodon = require('mastodon-api')
const mastodonClient = new Mastodon({
  access_token: MASTODON_ACCESS_TOKEN,
  timeout_ms: 60 * 1000,  // optional HTTP request timeout to apply to all requests.
  api_url: MASTODON_API_URL
})

function sendPrivateMessage (inReplyToId) {
  const params = {
    in_reply_to_id: inReplyToId,
    status: 'testing',
    visibility: 'direct'
  }
  return mastodonClient.post('statuses', params)
}

function followUser (accountId) {
  return mastodonClient.post(`accounts/${accountId}/follow`, { reblogs: false })
    .then(resp => resp.data.id)
}

function unfollowUser (accountId) {
  return mastodonClient.post(`accounts/${accountId}/unfollow`, {})
    .then(resp => resp.data.id)
}

function doesMessageHaveUnCaptionedImages(message) {
  const mediaAttachments = message.data.media_attachments
  const hasMediaAttachments = mediaAttachments.length > 0

  if (!hasMediaAttachments) {
    return false
  }

  const atleastOneAttachmentDoesntHaveACaption = mediaAttachments.some(mediaAttachment => {
    const doesntHaveACaption = mediaAttachment.description === null
    return doesntHaveACaption
  })

  return atleastOneAttachmentDoesntHaveACaption
}

function getFollowersAndFollowing (accountId) {
  const followerIdsPromise = mastodonClient.get(`accounts/${accountId}/followers`, {})
        .then(resp => resp.data)
        .then(users => users.map(user => user.id))

  const followingIdsPromise = mastodonClient.get(`accounts/${accountId}/following`, {})
        .then(resp => resp.data)
        .then(users => users.map(user => user.id))
  
  return Promise.all([followerIdsPromise, followingIdsPromise]).then(results => {
    const [followerIds, followingIds] = results
    return { followerIds, followingIds }
  })
}

function compareFollowersToFollowing () {
  return mastodonClient.get('accounts/verify_credentials', {})
    .then(resp => resp.data.id)
    .then(accountId => {
      return getFollowersAndFollowing(accountId).then(({ followerIds, followingIds }) => {
        // follow users that are following the bot
        const followNewUsersPromises = Promise.all(followerIds.filter(followerId => {
          const isFollowingUser = followingIds.includes(followerId)

          return !isFollowingUser
        })
        .map(followerId => {
          return followUser(followerId)
        }))

        // unfollow users the bot follows that arent following the bot
        const unfollowOldUsersPromises = Promise.all(followingIds.filter(followingId => {
          const isFollowedBackByUser = followerIds.includes(followingId)
          return !isFollowedBackByUser
        }).map(followingId => {
          return unfollowUser(followingId)
        }))

        return Promise.all([followNewUsersPromises, unfollowOldUsersPromises]).then(results => {
          const [ followedUsers, unfollowedUsers ] = results
          return { followedUsers, unfollowedUsers }
        })
      })
  })
}

function sendMessagesToTimeline() {
  const listener = mastodonClient.stream('streaming/user')
  console.log('Listening on the timeline for messages')

  listener.on('message', (message) => {
    console.log('Message received')

    if (message.event !== 'update') {
      return false
    }

    if (doesMessageHaveUnCaptionedImages(message)) {
      const messageId = message.data.id
      sendPrivateMessage(messageId).then(console.log).catch(console.error)
    }
  })

  listener.on('error', err => console.log(err))
}

// compareFollowersToFollowing().then(console.log).catch(console.error)
sendMessagesToTimeline()

module.exports = {
  compareFollowersToFollowing,
  sendMessagesToTimeline
}
