import Delogger from 'delogger'

import StellarAPI from '../utils/stellar'
import Config from '../utils/config'
import RocketWallet from '../model/rocketWallet'

const config = new Config({sync: true})
const STELLAR_COLD_ADDR = config.stellar.coldAddress
const STELLAR_KEYPAIR = config.stellar.address
const INTERVAL = config.stellar.checkInterval
const MARGE = 10 // Lumens

export default class Cold {
  constructor () {
    this.log = new Delogger('Cold')
    this.api = new StellarAPI()

    this.interval = setInterval(this.checkBalance.bind(this), INTERVAL)
  }

  checkBalance () {
    this.api.loadAccount(STELLAR_KEYPAIR.publicKey()).then((account) => {
      let stellarBalance = (account.balances.find((balance) => balance.asset_type === 'native')).balance
      this.log.info(`Current balance: ${stellarBalance} lumens`)
      if (stellarBalance > config.stellar.maxBalance) {
        let toSend = stellarBalance - config.stellar.maxBalance
        if (toSend > MARGE) {
          this.backupLumens(toSend.toFixed(7))
        }
      }

      if (stellarBalance <= config.stellar.warningBalance) {
        this.warningLowBalance(stellarBalance)
      }

      RocketWallet.update({
        address: STELLAR_KEYPAIR.publicKey()
      }, {
        balance: stellarBalance
      }).catch((err) => {
        this.log.error('Error updating balance')
        this.log.error(err)
      })
    })
  }

  backupLumens (amount) {
    this.api.send(STELLAR_KEYPAIR.secret(), STELLAR_COLD_ADDR, amount, {
      type: 'MemoNone',
      value: null
    }).then(() => {
      this.log.info(`Send ${amount} to cold wallet: ${STELLAR_COLD_ADDR}`)
    }).catch((err) => {
      this.log.error('Failed to send lumens to cold wallet')
      this.log.error(err)
    })
  }

  warningLowBalance (balance) {
    this.log.warning(`Wallet is almost empty`)
  }
}
