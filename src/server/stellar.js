import Delogger from 'delogger'

import Config from '../utils/config'
import Wallet from '../model/wallet'
import Transaction from '../model/transaction'

const config = new Config({sync: true})
const log = new Delogger('Stellar')

module.exports = (app) => {
  /*
  app.post('/withdraw')
  app.post('/deposit')
  */
}
