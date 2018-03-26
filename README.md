# Release Bot

Responds to `major`, `minor` or `patch` messages and will create a new release on github for swhurl-website. Release webhooks will then deploy to production via drone.swhurl.com.

Commands:

- `major|minor|patch` creates a new incremented release and tag on github
- `not live` returns list of commits since last tag

Environment variables:

- `TOKEN` - slackbot token
- `GITHUB_USER` - github `username`:`password|psersonal_access_token`

Docker: 

- `docker build -t registry.swhurl.com/swhurl/releasebot .`
- `docker run --name releasebot --restart always --init -d -e TOKEN=<MY_TOKEN> -e GITHUB_USER=<MY_GITHUB_USER> registry.swhurl.com/swhurl/releasebot`

