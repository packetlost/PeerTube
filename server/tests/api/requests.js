'use strict'

const chai = require('chai')
const each = require('async/each')
const expect = chai.expect
const request = require('supertest')

const loginUtils = require('../utils/login')
const podsUtils = require('../utils/pods')
const serversUtils = require('../utils/servers')
const videosUtils = require('../utils/videos')

describe('Test requests stats', function () {
  const path = '/api/v1/requests/stats'
  let servers = []

  function uploadVideo (server, callback) {
    const name = 'my super video'
    const description = 'my super description'
    const tags = [ 'tag1', 'tag2' ]
    const fixture = 'video_short.webm'

    videosUtils.uploadVideo(server.url, server.accessToken, name, description, tags, fixture, callback)
  }

  function getRequestsStats (server, callback) {
    request(server.url)
      .get(path)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer ' + server.accessToken)
      .expect(200)
      .end(callback)
  }

  // ---------------------------------------------------------------

  before(function (done) {
    this.timeout(20000)
    serversUtils.flushAndRunMultipleServers(2, function (serversRun, urlsRun) {
      servers = serversRun

      each(servers, function (server, callbackEach) {
        loginUtils.loginAndGetAccessToken(server, function (err, accessToken) {
          if (err) return callbackEach(err)

          server.accessToken = accessToken
          callbackEach()
        })
      }, function (err) {
        if (err) throw err

        const server1 = servers[0]
        podsUtils.makeFriends(server1.url, server1.accessToken, done)
      })
    })
  })

  it('Should have a correct timer', function (done) {
    const server = servers[0]

    getRequestsStats(server, function (err, res) {
      if (err) throw err

      const body = res.body
      expect(body.remainingMilliSeconds).to.be.at.least(0)
      expect(body.remainingMilliSeconds).to.be.at.most(10000)

      done()
    })
  })

  it('Should have the correct request', function (done) {
    this.timeout(15000)

    const server = servers[0]
    // Ensure the requests of pod 1 won't be made
    servers[1].app.kill()

    uploadVideo(server, function (err) {
      if (err) throw err

      getRequestsStats(server, function (err, res) {
        if (err) throw err

        const body = res.body
        expect(body.requests).to.have.lengthOf(1)

        const request = body.requests[0]
        expect(request.to).to.have.lengthOf(1)
        expect(request.request.type).to.equal('add')

        // Wait one cycle
        setTimeout(done, 10000)
      })
    })
  })

  it('Should have the correct requests', function (done) {
    const server = servers[0]

    uploadVideo(server, function (err) {
      if (err) throw err

      getRequestsStats(server, function (err, res) {
        if (err) throw err

        const body = res.body
        expect(body.requests).to.have.lengthOf(2)

        const request = body.requests[1]
        expect(request.to).to.have.lengthOf(1)
        expect(request.request.type).to.equal('add')

        done()
      })
    })
  })

  after(function (done) {
    process.kill(-servers[0].app.pid)

    if (this.ok) {
      serversUtils.flushTests(done)
    } else {
      done()
    }
  })
})
