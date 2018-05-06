import StellarSdk from 'stellar-sdk'
import Delogger from 'delogger'

import Config from './config'

const config = new Config({sync: true})

const NET = config.stellar.network
const NET_SERVER = config.stellar.network === 'public' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'

class API {
  constructor () {
    this.log = new Delogger('Stellar')
    if (NET === 'public') {
      this.log.info('Using public network')
      StellarSdk.Network.usePublicNetwork()
    } else {
      this.log.info('Using test network')
      StellarSdk.Network.useTestNetwork()
    }
    this.stellarServer = new StellarSdk.Server(NET_SERVER)
  }

  moneyFactor () {
    return 10000000
  }

  loadAccount (publicKey) {
    return new Promise((resolve, reject) => {
      if (!publicKey) {
        reject(Error('Empty publicKey'))
        return
      }
      this.stellarServer.loadAccount(publicKey)
        .then(resolve)
        .catch(reject)
    })
  }

  existAccount (publicKey) {
    return new Promise((resolve, reject) => {
      if (!publicKey) {
        reject(Error('Empty publicKey'))
        return
      }
      this.loadAccount(publicKey).then(() => resolve({
        valid: true,
        address: publicKey
      })).catch(() => resolve({
        valid: false,
        address: publicKey
      }))
    })
  }

  keypairFromSecret (secret) {
    return StellarSdk.Keypair.fromSecret(secret)
  }

  send (secretKey, destination, amount, memo) {
    return new Promise((resolve, reject) => {
      const keypair = this.keypairFromSecret(secretKey)

      this.loadAccount(keypair.publicKey()).then((account) => {
        let operation = StellarSdk.Operation.payment({
          destination,
          amount,
          asset: StellarSdk.Asset.native()
        })

        let memoObj = new StellarSdk.Memo(getMemoFromString(memo.type), memo.value)

        let transaction = new StellarSdk.TransactionBuilder(account)
          .addOperation(operation)
          .addMemo(memoObj)
          .build()

        transaction.sign(keypair)

        this.stellarServer.submitTransaction(transaction).then(resolve).catch(reject)
      }).catch(reject)
    })
  }

  createOperation (destination, amount) {
    amount = amount.toString()
    return StellarSdk.Operation.payment({
      destination,
      amount,
      asset: StellarSdk.Asset.native()
    })
  }

  sendOperations (secretKey, operations, memo) {
    return new Promise((resolve, reject) => {
      if (!(operations instanceof Array)) {
        operations = [operations]
      }
      const keypair = this.keypairFromSecret(secretKey)

      this.loadAccount(keypair.publicKey()).then((account) => {
        let memoObj = new StellarSdk.Memo(getMemoFromString(memo.type), memo.value)

        let transaction = new StellarSdk.TransactionBuilder(account)

        for (let op of operations) {
          transaction = transaction.addOperation(op)
        }

        transaction = transaction.addMemo(memoObj)
          .build()

        transaction.sign(keypair)

        this.stellarServer.submitTransaction(transaction).then(resolve).catch(reject)
      }).catch(reject)
    })
  }

  loadTransactions (publicKey) {
    return new Promise((resolve, reject) => {
      var transactions = []
      this.stellarServer.transactions()
        .forAccount(publicKey)
        .order('desc')
        .call().then((tr) => {
          for (let transaction of tr.records) {
            transactions.push({
              metadata: transaction,
              envelope: new StellarSdk.Transaction(transaction.envelope_xdr)
            })
          }
          resolve(transactions)
        }).catch(reject)
    })
  }

  transactionFromXdr (transaction) {
    return new StellarSdk.Transaction(transaction.envelope_xdr)
  }
}

module.exports = API

function getMemoFromString (string) {
  switch (string) {
    case 'MemoText':
      return StellarSdk.MemoText
    case 'MemoID':
      return StellarSdk.MemoID
    case 'MemoHash':
      return StellarSdk.MemoHash
    case 'MemoReturn':
      return StellarSdk.MemoReturn
    case 'MemoNone':
    default:
      return StellarSdk.MemoNone
  }
}
