# About project

this is a service that supports messaging<br>

# Table of content

[prerequisites](#-prerequisites)<br>
[setup](#-setup)<br>
[getting started](#-getting-started)<br>
[run test (comming soon)](#-run-test)<br>
[learn more](#-learn-more)<br>
[deployment (comming soon)](#-deploy-on-vercel)<br>

## ⇁ Prerequisites

you must have npm installed<br>
database of your choice<br>

## ⇁ Setup

first, clone this project<br>
install packages:<br>

```shell
npm install
```

you need to have `.env` file in root project, in the file you need `key=value` each line. See list of required environment variables [here](#-list-of-available-environment-variables):<br>

to update your database schema, first, start your database, then if you want to update your dev environment, run this command:

```bash
npx prisma db push --schema=./environments/dev/schema.prisma
```

or if you want to update your prod environment, run this:

```bash
npx prisma db push --schema=./environments/prod/schema.prisma
```

## ⇁ List of available environment variables

| Variable              | Required | Purpose                        |
| --------------------- | -------- | ------------------------------ |
| PORT                  | NO       | server's port. Default: `8010` |
| AUTH_SERVICE_ENDPOINT | YES      | endpoint for auth service      |
| CLIENT_ENDPOINT       | YES      | endpoint for client app        |
| DATABASE_URL          | YES      | URL to your database           |

you can check for an example [here](./templates/.env.template)<br>

## ⇁ Getting Started

First, run the development server:

```bash
npm run dev
```

## ⇁ Run test
