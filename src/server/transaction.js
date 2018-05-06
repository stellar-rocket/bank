import Delogger from 'delogger'

import Config from '../utils/config'
import Wallet from '../model/wallet'
import Transaction from '../model/transaction'

const config = new Config({sync: true})
const log = new Delogger('Transaction')

module.exports = (app) => {
  // Lister les transactions d'un wallet
  app.get('/transaction/:walletId(\\w+)/?(:from(\\d+))?', (req, res) => {
    let walletId = req.params.walletId
    let from = Math.max(req.params.from, 0)

    Wallet.findOne({
      _id: walletId
    }).populate('transactions').then((doc) => {
      if (!doc) {
        res.status(404)
        return res.json({
          err: 'Wallet not found'
        })
      }

      let transactions = doc.transactions.sort((a, b) => a.date - b.date).slice(from, 20)
      // TODO
      // retourner les 20 transactions depuis from

      res.json(transactions)
    }).catch((err) => {
      log.error('Failed retrieving wallet')
      log.error(err)

      res.status(500)
      res.end()
    })
  })

  // Créer une transaction pour un wallet
  app.post('/transaction/:walletId(\\w+)', (req, res) => {
    let walletId = req.params.walletId

    let transaction = req.body.transaction

    if (!transaction) {
      res.status(400)
      return res.json({
        err: 'Mission operations'
      })
    }

    if (!(transaction instanceof Object)) {
      res.status(401)
      return res.json({
        err: 'Invalid operations'
      })
    }

    Wallet.findOne({
      _id: walletId
    }).then((doc) => {
      if (!doc) {
        res.status(404)
        return res.json({
          err: 'Wallet not found'
        })
      }

      transaction.wallet = walletId

      if (!transaction.type || !transaction.amount) {
        res.status(400)
        return res.json({
          err: 'Missing attributs',
          transaction
        })
      }

      // Prevent id duplication
      delete transaction._id
      let transactionObj = new Transaction(transaction)

      return doc.appendTransaction(transactionObj).then((result) => {
        if (result instanceof Error) {
          res.status(403)
          return res.json({
            err: result.message
          })
        }

        log.info(`Adding transaction to wallet ${doc._id}`)
        res.json(doc)
      })
    }).catch((err) => {
      log.error('Failed create transaction for wallet')
      log.error(err)

      res.status(500)
      res.end()
    })
  })
}
