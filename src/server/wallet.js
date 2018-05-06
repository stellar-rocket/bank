import Delogger from 'delogger'
import Config from '../utils/config'
import Wallet from '../model/wallet'
import User from '../model/user'

const config = new Config({sync: true})
const log = new Delogger('Wallet')

module.exports = (app) => {
  app.get('/wallet/stellarRocketAddress', (req, res) => {
    res.end(config.stellar.address.publicKey())
  })

  app.get('/wallet/:id', (req, res) => {
    let walletId = req.params.id

    Wallet.findOne({
      _id: walletId
    }).then((doc) => {
      if (!doc) {
        res.status(404)
        return res.json({
          err: 'Wallet not found'
        })
      }

      res.json(doc)
    }).catch((err) => {
      log.error('Failed retrieving wallet')
      log.error(err)

      res.status(500)
      res.end()
    })
  })

  // Creer un wallet pour l'utilisateur for
  app.put('/wallet/:for', (req, res) => {
    let userId = req.params.for

    User.findOne({
      _id: userId
    }).then((doc) => {
      if (!doc) {
        res.status(404)
        return res.json({
          err: 'User not found'
        })
      }

      if (doc.wallet) {
        res.status(409)
        return res.json({
          err: 'User already have a wallet'
        })
      }

      let wallet = new Wallet({
        user: userId,
        locked: false,
        balance: 0
      })

      return wallet.save().then(() => {
        doc.wallet = wallet._id
        return doc.save()
      }).then(() => {
        log.info(`Creating wallet for ${doc._id}`)
        res.json(wallet)
      })
    }).catch((err) => {
      if (err.code === 11000) {
        res.status(409)
        return res.json({
          err: 'User already have a wallet'
        })
      }

      log.error('Failed create wallet')
      log.error(err)

      res.status(500)
      res.end()
    })
  })
}
