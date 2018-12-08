// package imports
const fs = require('fs')
const cp = require('child_process')
const SlackBot = require('slackbots')
const axios = require('axios')
const qs = require('querystring')
const cmp = require('semver-compare')
const semver = require('semver')
const debug = require('debug')('releasebot')

// env variables
const token = process.env.TOKEN || null
const github = process.env.GITHUB_USER || null
const circleci = process.env.CIRCLECI_API_KEY || null

// constants
const commitsCmds = [`notlive`, `staged`, `staging`, `integration`, `unreleased`]
const releaseCmds = [`major`, `minor`, `patch`]
const REPO_URL = 'api.github.com/repos/samclement/swhurl-website/releases'
const CLONE_PATH = './repo/swhurl-website/.git'

const bot = new SlackBot({
  token,
  name: 'releasebot'
})

// Clone repo
if (!fs.existsSync(CLONE_PATH)) {
  const cloneCmd = 'git clone https://github.com/samclement/swhurl-website.git'
  cp.exec(cloneCmd, { cwd: './repo' }, (err, stdout, stderr) => {
    if (err) console.error(err)
    else console.log('start: clone successful.')
  })
} else {
  console.log('start: try git pull')
  gitPull()
    .catch(console.error)
}

bot.on('start', () => {
  console.log(`start: relasebot online!`)
})

bot.on('close', () => {
  console.log('closed')
})

bot.on('error', (err) => {
  console.error(err)
})

bot.on('message', (data) => {
  if (data.subtitle && data.subtitle == 'sam') { // only dms from 'sam'
    const cmd = data.content.toLowerCase().replace(' ', '')
    debug(`message recieved: '${cmd}'.`)
    if (commitsCmds.includes(cmd)) {
      gitPull()
        .then(getTagsFromGithub)
        .then(getLatestAndIncrementTags(cmd))
        .then(getCommitsSinceLastTag)
        .then(sendCommitsSinceLastTag)
        .catch(console.error)
    } else if (releaseCmds.includes(cmd)) {
      gitPull()
        .then(getTagsFromGithub)
        .then(getLatestAndIncrementTags(cmd))
        .then(getCommitsSinceLastTag)
        .then(createRelease)
        .catch(console.error)
    } else if (cmd.includes(`deploy`)) {
      console.log(cmd)
      const tag = cmd.substr(6, cmd.length)
      getTag(tag)
        .then(startJob(tag))
        .then(sendMessage(tag))
        .catch((err) => {
          Object.keys(err).forEach((key) => console.log)
          const message = err.response && err.response.status == 404 ? `Tag not found` : err.toString()
          bot.postMessageToUser(
            'sam',
            message
          )
          console.error(err)
        })
    }
  }
})

bot.on('error', (err) => {
  console.error(`bot error: ${err}`)
})

bot.on('close', (data) => {
  console.log(`bot close: ${data}`)
})

function sendCommitsSinceLastTag(tagsAndCommits) {
  const commits = tagsAndCommits.commits
  const tags = tagsAndCommits.tags
  let message = `No commits since \`${tagify(tags.latest)}\`.`
  debug(`send commits since last tag: %O`, tagsAndCommits)
  if (commits.length != 0) {
    message = `Commits since \`${tagify(tags.latest)}\`:\n`
    message += commits
      .split('\n')
      .filter((m) => m != '')
      .map(formatCommitMessages)
      .join('\n')
  }
  console.log(`send commits since %s: %s`, tagify(tags.latest), commits || 'none')
  bot.postMessageToUser('sam', message)
}

function createRelease(tagsAndCommits) {
  const tags = tagsAndCommits.tags
  const commits = tagsAndCommits.commits
  if (commits.length == 0) {
    const message = `No commits since \`${tagify(tags.latest)}\`. No release created.`
    bot.postMessageToUser('sam', message, (data) => {
      if (data.ok) console.log(`create release - no commits: %s`, data.message.text)
      else console.error(`create release: %O`, data)
    })
  } else {
    const postUrl = `https://${github}@${REPO_URL}`
    const payload = {
      tag_name: `${tagify(tags.increment)}`,
      target_commitish: `master`,
      name: `Version ${tags.increment} release`,
      body: commits
    }
    debug(`create release - payload: %0`, payload)
    axios.post(postUrl, payload)
      .then((res) => {
        const d = res.data
        console.log(`create release - github response: %O`, d)
        bot.postMessageToUser(
          'sam',
          `\`${d.tag_name}\` created from \`${d.target_commitish}\``
        )
      })
  }
}

function formatCommitMessages(m) {
  const commitUrl = 'https://github.com/samclement/swhurl-website/commit/'
  const hash = m.substr(0,7)
  return `<${commitUrl}${hash}|${hash}>${m.substr(7,m.length)}`
}

function gitPull() {
  return new Promise((resolve, reject) => {
    const pullCmd = `git fetch --tags && git pull origin master --rebase`
    cp.exec(pullCmd, { cwd: `./repo/swhurl-website` }, (err, stdout, stderr) => {
      if (err) {
        console.error(err)
        reject(err)
      } else {
        debug(`git pull: %s`, stdout)
        resolve(stdout)
      }
    })
  })
}

function getTagsFromGithub() {
  return axios.get(`https://${REPO_URL}`)
}

function getLatestAndIncrementTags(cmd) {
  return async (res) => {
    const latest = res.data.map((r) => r.tag_name.replace('v', '')).sort(cmp).pop()
    const increment = semver.inc(latest, cmd)
    const tags = { latest, increment }
    debug(`get latest and increment tags: %O`, tags)
    return await tags
  }
}

function getCommitsSinceLastTag(tags) {
  const logCmd = `git --no-pager log --oneline v${tags.latest}..HEAD`
  return new Promise((resolve, reject) => {
    cp.exec(logCmd, { cwd: './repo/swhurl-website' }, (err, stdout, stderr) => {
      debug(`get commits since %s: %s`, tagify(tags.latest), stdout || 'none')
      if (err || stderr) {
        reject(err || stderr)
      } else {
        resolve({tags, commits: stdout})
      }
    })
  })
}

function tagify(tag) {
  return `v${tag}`
}

// Deploy

function getTag(tag) {
  return axios.get(`https://api.github.com/repos/samclement/swhurl-website/releases/tags/v${tag}`)
}

function startJob(tag) {
  const postUrl = `https://${circleci}:@circleci.com/api/v1.1/project/github/samclement/swhurl-website/tree/master`
  const payload = { 'build_parameters[CIRCLE_JOB]': 'release_tag', 'build_parameters[CIRCLE_TAG]': tag }
  return axios.post(postUrl, qs.stringify(payload))
}

function sendMessage(tag) {
  const message = `Deploying ${tagify(tag)}`
  return bot.postMessageToUser(
    'sam',
    message
  )
}
