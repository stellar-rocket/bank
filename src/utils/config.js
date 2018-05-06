import fs from 'fs'
import Delogger from 'delogger'
import StellarSdk from 'stellar-sdk'
import EventEmitter from 'events'
import { expect } from 'chai'

import template from './config.template'

export const ConfigLocation = `config.json`

export default class Config extends EventEmitter {
  constructor (props) {
    super()
    props = props || {}
    this.location = process.env.CONFIG_PATH || ConfigLocation
    this.log = new Delogger('Config')

    let config
    if (props.sync) {
      try {
        var data = fs.readFileSync(this.location)
        config = this.parseConfig(data)
        this.assignConfig(config)
      } catch (err) {
        if (err.code === 'ENOENT') {
          this.generateConfig()
        } else {
          this.log.error(err)
        }
      }
    } else {
      fs.readFile(this.location, (err, data) => {
        if (err && err.code === 'ENOENT') {
          this.generateConfig()
        } else if (!err) {
          config = this.parseConfig(data)
          this.assignConfig(config)
        } else {
          this.log.error(err)
        }
      })
    }
  }

  generateConfig () {
    this.assignConfig(template)
    try {
      fs.writeFileSync(this.location, JSON.stringify(template, 'undefined', 2))
    } catch (err) {
      this.log.error(err)
    }
  }

  parseConfig (string) {
    let config = JSON.parse(string)

    expect(config).to.have.property('database').to.be.a('object')
    expect(config.database).to.have.property('type').to.be.equal('mongodb')
    expect(config.database).to.have.property('host').to.be.a('string').not.empty
    expect(config.database).to.have.property('port').to.be.a('number').within(0, 65535)
    expect(config.database).to.have.property('database').to.be.a('string').not.empty

    expect(config.database).to.have.property('username').to.be.a('string').not.empty
    expect(config.database).to.have.property('password').to.be.a('string').not.empty

    expect(config).to.have.property('secret').to.be.a('string').not.empty

    expect(config).to.have.property('server').to.be.a('object')
    expect(config.server).to.have.property('port').to.be.a('number').within(0, 65535)
    expect(config.server).to.have.property('host').to.be.a('string').not.empty

    expect(config).to.have.property('stellar').to.be.a('object')
    expect(config.stellar).to.have.property('network').to.be.a('string').to.match(/(test|public)/)
    expect(config.stellar).to.have.property('withdraw').to.be.a('object')
    expect(config.stellar.withdraw).to.have.property('interval').to.be.a('number').to.be.at.least(5000)
    expect(config.stellar.withdraw).to.have.property('operationCount').to.be.a('number').to.be.at.below(20)
    expect(config.stellar).to.have.property('minBalance').to.be.a('number').to.be.at.least(5)
    expect(config.stellar).to.have.property('maxBalance').to.be.a('number').to.be.at.least(10)
    expect(config.stellar).to.have.property('warningBalance').to.be.a('number').to.be.at.least(5)
    expect(config.stellar).to.have.property('checkInterval').to.be.a('number').to.be.at.least(5000)

    expect(process.env.STELLAR_ADDRESS).to.be.a('string')
    config.stellar.address = StellarSdk.Keypair.fromSecret(process.env.STELLAR_ADDRESS)
    expect(process.env.STELLAR_COLD_ADDRESS).to.be.a('string')
    config.stellar.coldAddress = process.env.STELLAR_COLD_ADDRESS

    return config
  }

  assignConfig (config) {
    Object.assign(this, config)

    this.emit('ready')
  }
}
