import Delogger from 'delogger'
import Mongoose from 'mongoose'
import BigInt from 'big-integer'

import StellarAPI from '../utils/stellar'
import Config from '../utils/config'
import RocketWallet from '../model/rocketWallet'
import Wallet from '../model/wallet'
import Transaction from '../model/transaction'
import Cold from './cold'

const config = new Config({sync: true})
const STELLAR_KEYPAIR = config.stellar.address

export default class Rocket {
  constructor () {
    this.log = new Delogger('Rocket')
    this.api = new StellarAPI()
    this.cold = new Cold()
    this.account = null
    this.rocketWallet = null
    this.withDrawInterval = null
  }

  init () {
    return new Promise((resolve, reject) => {
      return RocketWallet.findOne({
        address: STELLAR_KEYPAIR.publicKey()
      }).then((wallet) => {
        if (!wallet) {
          wallet = new RocketWallet({
            address: STELLAR_KEYPAIR.publicKey()
          })
          wallet.save()
        }
        this.rocketWallet = wallet
        return this.api.loadAccount(this.rocketWallet.address)
      }).then((account) => {
        this.account = account
        this.initAccount()
        resolve()
      }).catch(reject)
    })
  }

  initAccount () {
    if (this.account === null) {
      return null
    }

    this.log.info(`Init account id : ${this.account.id}`)
    console.log('cursor', this.rocketWallet.cursor)
    this.api.stellarServer.transactions().forAccount(this.account.id).cursor(this.rocketWallet.cursor).stream({ onmessage: this.handleIncomingMessage.bind(this) })
    this.initHandleWithdraw()
  }

  handleIncomingMessage (message) {
    if (message.memo_type !== 'text') {
      return null
    }

    let walletId = message.memo
    let pagingToken = BigInt(message.paging_token)
    let transaction = this.api.transactionFromXdr(message)

    if (!Mongoose.Types.ObjectId.isValid(walletId)) {
      return null
    }

    for (let op of transaction.operations) {
      if (op.destination === this.rocketWallet.address && op.asset.code === 'XLM') {
        let amount = parseFloat(op.amount) * this.api.moneyFactor()
        if (isNaN(amount)) {
          this.log.info(`Someone fail is transaction. txHash: ${transaction.id}`)
          return null
        }
        this.handleDeposit(transaction.source, walletId, amount).then(() => {
          this.log.info(`${walletId} receiv ${amount} stroops`)
          return this.rocketWallet.update({
            $set: {
              cursor: BigInt.max(pagingToken, BigInt(this.rocketWallet.cursor)).toString()
            }
          })
        }).catch((err) => {
          this.log.error(`Failed to handle deposit for wallet ${walletId}. txHash: ${transaction.id}`)
          this.log.error(err)
        })
      }
    }
  }

  handleDeposit (sourceAddr, walletId, amount) {
    return new Promise((resolve, reject) => {
      Wallet.findOne({
        _id: walletId
      }).then((wallet) => {
        if (!wallet) {
          resolve()
          return null
        }

        let transaction = new Transaction({
          wallet: wallet._id,
          type: 'deposit',
          amount,
          address: sourceAddr
        })

        return wallet.appendTransaction(transaction)
      }).then(() => {
        return this.api.loadAccount(STELLAR_KEYPAIR.publicKey())
      }).then((account) => {
        let stellarBalance = (account.balances.find((balance) => balance.asset_type === 'native')).balance
        this.log.info(`Stellar balance: ${stellarBalance} lumens`)
        resolve()
      }).catch(reject)
    })
  }

  initHandleWithdraw () {
    this.withDrawInterval = setInterval(this.handleWithdraw.bind(this), config.stellar.withdraw.interval) // 300000
  }

  handleWithdraw () {
    this.log.info('Fetching for withdraw request...')
    Transaction.find({
      type: 'withdraw',
      status: 'progress'
    }).limit(config.stellar.withdraw.operationCount).then((docs) => {
      this.log.info(`Found ${docs.length} withdraw request`)
      if (docs.length <= 0) {
        return null
      }

      return this.updateTransaction(docs, 'processing').then(() => {
        return Promise.all(docs.map((tr) => {
          return this.api.existAccount(tr.address)
        })).then((validity) => {
          let toRefuse = []
          let toAccept = []
          for (let tr of docs) {
            let isValid = (validity.find((valid) => valid.address === tr.address)).valid
            if (isValid) {
              toAccept.push(tr)
            } else {
              toRefuse.push(tr)
            }
          }

          return Promise.all([
            this.withdraw(toAccept),
            this.updateTransaction(toRefuse, 'refused')
          ])
        }).then((res) => {
          this.log(`Submitted transactions to the Stellar network`)
        })
      })
    }).catch((err) => {
      this.log.error('Fail to fetch withdraw request')
      this.log.error(err)
    })
  }

  withdraw (transactions) {
    return new Promise((resolve, reject) => {
      if (transactions.length <= 0) {
        resolve()
        return
      }

      this.api.loadAccount(STELLAR_KEYPAIR.publicKey()).then((account) => {
        let stellarBalance = (account.balances.find((balance) => balance.asset_type === 'native')).balance

        let totalOperation = transactions.reduce((total, tr) => {
          return total + (tr.amount / this.api.moneyFactor())
        }, 0)

        if (totalOperation < (stellarBalance - config.stellar.minBalance)) { // Always keep 5 lumens in wallet
          let operations = transactions.map((tr) => {
            return this.api.createOperation(tr.address, tr.amount / this.api.moneyFactor())
          })

          this.api.sendOperations(STELLAR_KEYPAIR.secret(), operations, 'From Stellar-Rocket').then((res) => {
            this.log.info(`Stellar balance: ${stellarBalance - totalOperation} lumens`)
            return this.updateTransaction(transactions, 'done')
          }).catch((err) => {
            this.log.error('Failed to submit withdraw')
            this.log.error(err)
            this.updateTransaction(transactions, 'progress').then(() => {
              reject(err)
            }).catch(reject)
          })
        } else {
          this.log.warning('Stellar balance is underfunded.')
          this.updateTransaction(transactions, 'progress').then(() => {
            reject(new Error('Stellar balance is underfunded.'))
          }).catch(reject)
        }
      })
    })
  }

  updateTransaction (transactions, status) {
    return Promise.all(transactions.map((tr) => {
      this.log.info(`${status} withdraw of ${tr.amount} stroops to ${tr.address}`)
      return Transaction.update({
        _id: tr._id
      }, {
        $set: {
          status: status
        }
      })
    }))
  }
}
