const template = {
  database: {
    type: 'mongodb',
    host: '127.0.0.1',
    port: 27017,
    database: 'stellar-rocket-app',
    username: '',
    password: ''
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  secret: 'some_secret',
  stellar: {
    network: 'test',
    withdraw: {
      interval: 300000, // ms
      operationCount: 10
    },
    minBalance: 5, // Lumens
    maxBalance: 1000, // Lumens
    warningBalance: 100, // lumens
    checkInterval: 5000 // ms
  }
}

module.exports = template

if (__filename.match(/.*template.*/g)) {
  console.log(JSON.stringify(template, 'undefined', 2))
}
