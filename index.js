// package imports
const fs = require('fs')
const cp = require('child_process')
const SlackBot = require('slackbots')
const axios = require('axios')
const cmp = require('semver-compare')
const semver = require('semver')
// env variables
const token = process.env.TOKEN || null
const github = process.env.GITHUB_USER || null
// constants
const MAJOR = `major`
const MINOR = `minor`
const PATCH = `patch`
const NOT_LIVE = `notlive`
const STAGED = 'staged'
const commitsCmds = [NOT_LIVE, STAGED]
const releaseCmds = [MAJOR, MINOR, PATCH]
const REPO_URL = 'api.github.com/repos/samclement/swhurl-website/releases'

const bot = new SlackBot({
  token,
  name: 'releasebot'
})

bot.on('start', () => {
  console.log(`relasebot online!`)
  if (!fs.existsSync('./repo/swhurl-website/.git')) {
    const cloneCmd = 'git clone https://github.com/samclement/swhurl-website.git'
    cp.exec(cloneCmd, { cwd: './repo' }, (err, stdout, stderr) => {
      if (err) console.log(err)
      else console.log('clone successful')
    })
  } else {
    gitPull()
      .then(console.log)
      .catch(console.error)
  }
})

bot.on('message', (data) => {
  if (data.subtitle && data.subtitle == 'sam') { // only dms from 'sam'
    const cmd = data.content.toLowerCase().replace(' ', '')
    console.log(cmd, releaseCmds.includes(cmd))
    if (commitsCmds.includes(cmd)) {
      gitPull()
        .then(getTagsFromGithub)
        .then(getTags(cmd))
        .then(getCommitsSinceLastTag)
        .then(sendCommitsSinceLastTag)
        .catch(console.error)
    } else if (releaseCmds.includes(cmd)) {
      gitPull()
        .then(getTagsFromGithub)
        .then(getTags(cmd))
        .then(getCommitsSinceLastTag)
        .then(attemptRelease)
        .catch(console.error)
    }
  }
})

function sendCommitsSinceLastTag(tagsAndCommits) {
  const commits = tagsAndCommits.commits
  const tags = tagsAndCommits.tags
  let message = `No commits since \`${tagify(tags.tag)}\`.`
  if (commits.length != 0) {
    message = `Commits since \`${tagify(tags.tag)}\`:\n`
    message += commits
      .split('\n')
      .filter((m) => m != '')
      .map(formatCommitMessages)
      .join('\n')
  }
  bot.postMessageToUser('sam', message)
}

function formatCommitMessages(m) {
  const commitUrl = 'https://github.com/samclement/swhurl-website/commit/'
  const hash = m.substr(0,7)
  return `<${commitUrl}${hash}|${hash}>${m.substr(7,m.length)}`
}

function attemptRelease(tagsAndCommits) {
  const tags = tagsAndCommits.tags
  const commits = tagsAndCommits.commits
  if (commits.length == 0) {
    const message = `No commits since \`${tagify(tags.tag)}\`. No release created.`
    bot.postMessageToUser('sam', message, (data) => {
      if (data.ok) console.log(data.message.text)
      else console.log(data)
    })
  } else {
    const postUrl = `https://${github}@${REPO_URL}`
    const payload = {
      tag_name: `${tagify(tags.newTag)}`,
      target_commitish: `master`,
      name: `Version ${tags.newTag} release`,
      body: commits
    }
    console.log(`payload: ${JSON.stringify(payload)}`)
    axios.post(postUrl, payload)
      .then((res) => {
        const d = res.data
        bot.postMessageToUser(
          'sam',
          `\`${d.tag_name}\` created from \`${d.target_commitish}\``
        )
      })
  }
}

function gitPull() {
  return new Promise((resolve, reject) => {
    const pullCmd = `git pull origin master --rebase`
    cp.exec(pullCmd, { cwd: `./repo/swhurl-website` }, (err, stdout, stderr) => {
      if (err) {
        console.log(err)
        reject(err)
      } else {
        console.log(stdout || stderr)
        resolve(stdout)
      }
    })
  })
}

function getTagsFromGithub() {
  return new Promise((resolve, reject) => {
    axios.get(`https://${REPO_URL}`)
      .then((res) => {
        resolve(res)
      })
  })
}

function getTags(cmd) {
  return function(res) {
    return new Promise((resolve, reject) => {
      if (!res.data) {
        reject(res)
      } else {
        const tag = res.data.map((r) => r.tag_name.replace('v', '')).sort(cmp).pop()
        const newTag = semver.inc(tag, cmd)
        resolve({tag, newTag})
      }
    })
  }
}

function getCommitsSinceLastTag(tags) {
  const logCmd = `git --no-pager log --oneline v${tags.tag}..HEAD`
  return new Promise((resolve, reject) => {
    cp.exec(logCmd, { cwd: './repo/swhurl-website' }, (err, stdout, stderr) => {
      console.log(`stdout: ${stdout}`)
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
