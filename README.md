# Release Bot

Responds to `major`, `minor` or `patch` messages and will create a new release on github for swhurl-website. 

Commands:

- `major|minor|patch` creates a new incremented release and tag on github
- `unreleased` returns list of commits since last tag

Environment variables:

- `TOKEN` - slackbot token
- `GITHUB_USER` - github `username`:`password|psersonal_access_token`
- `CIRCLECI_API_KEY` - circleci api key

Docker: 

- `docker build -t swhurl/releasebot .`
- `docker push swhurl/releasebot`
- `docker run --name releasebot --restart always --init -d -e TOKEN=<MY_TOKEN> -e GITHUB_USER=<MY_GITHUB_USER> -e CIRCLECI_API_KEY=<MY_CIRCLECI_API_KEY> swhurl/releasebot`

