const fetch = require('node-fetch');
var user = "BankinUser", password = "12345678", clientId = "BankinClientId", clientSecret= "secret";

/**
 * @description Trying to get the refresh token
 * @return the refresh token
 */
async function getRefreshToken() {
  console.log('--- Try to get the refresh token ---')
  let response = await fetch(
    "http://localhost:3000/login",
    {
      method: 'POST',
      headers: {
          'Authorization': 'Basic ' + Buffer.from(clientId + ":" + clientSecret).toString('base64'),
          'Content-Type': 'application/json'
        },
      body: JSON.stringify({"user": user,"password": password}),
      redirect: 'follow'
    })
  let data = await response.json();
  let token = await data.refresh_token;
  return token
}

/**
 * @description Trying to get the access token
 * @return the acces token
 */
async function getAccessToken(refreshToken) {
  try {
    var urlencoded = new URLSearchParams();
    urlencoded.append("grant_type", "refresh_token");
    urlencoded.append("refresh_token", refreshToken);

    console.log('--- Try to get the access token ---')
    let response = await fetch(
      "http://localhost:3000/token",
      {
        method : 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: urlencoded,
        redirect: 'follow'
      })
    let data = await response.json();
    let accessToken = await data.access_token;
    return accessToken
  } catch(error) {
    console.log(error);
  }
}

/**
 * @description Fetch accounts until last page
 * @param {String} accessToken Access token to get the data needed
 * @return all of the unique accounts
 */
async function getUniqueAccounts(accessToken) {
  var dataAccounts = [];
  try {
    var page = 1;
    var hasNextPage = true;

    while (hasNextPage) {
      console.log(`--- Fetch Accounts page n°${page} ---`)
      let response = await fetch(
        'http://localhost:3000/accounts?' + `page=${page}` ,
        {
          method: 'GET',
          withCredentials: true,
          credentials: 'include',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
          redirect: 'follow'
        })
        let data = await response.json();
        hasNextPage = data.link.next;
        dataAccounts = dataAccounts.concat(data.account);
        page +=1;
    }
    let uniqueAccount = dataAccounts.filter((v, i, a) => a.indexOfAccNumber(v.acc_number) === i);
    return uniqueAccount
  } catch(error) {
    console.log(error);
  }
}

/**
 * @description Fetch all transactions from an account
 * @param {String} accountNumber Account id 
 * @param {String} accessToken Number of the page
 * @return All unique transactions made by an account
 */
async function getUniqueTransactions(accountNumber, accessToken){
  var dataTransactions = [];
  try {
    var page = 1;
    var hasNextPage = true;

    while(hasNextPage) {
      console.log(`--- Fetch Transaction page n°${page} of Account n°${accountNumber} ---`)
      let response = await fetch(
        'http://localhost:3000/accounts/' + accountNumber + '/transactions?' + `page=${page}` ,
        {
          method: 'GET',
          withCredentials: true,
          credentials: 'include',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
          },
          redirect: 'follow'
        })
      var data = await response.json();
      hasNextPage = data.link.next;
      dataTransactions = dataTransactions.concat(data.transactions);
      page +=1;
    }
    dataTransactions = dataTransactions.filter((v,i,a) => a.indexOfId(v.id)=== i).map(transaction => parseTransaction(transaction));
    return dataTransactions
  } catch(error) {
    console.log(error.toString(), `--- Error with account id n°${accountNumber} at page n°${page}`)
  }
}

/**
 * @description Parse the transaction looking at the sign of the transaction
 * @param {Array} transaction transaction to process
 * @return a transaction in the required format
 */
function parseTransaction(transaction) {
  var transactionInfo = {"label": transaction.label, "amount": null, "currency": transaction.currency};
  if (transaction.sign === "DBT" ) {
    transactionInfo.amount = "-" + transaction.amount;
  } else {
    transactionInfo.amount = transaction.amount;
  }
  return transactionInfo
}

async function main() {
  try {
    const refreshToken = await getRefreshToken();
    const accessToken = await getAccessToken(refreshToken);
    var uniqueAccounts = await getUniqueAccounts(accessToken);

    var result = [];
    for (account of uniqueAccounts) {
      transactions = await getUniqueTransactions(account.acc_number, accessToken);
      accountTransactions = {"acc_number": account.acc_number, "amount": account.amount, "transactions": transactions};
      result.push(accountTransactions);
      console.log(accountTransactions);
    }
    return result
  } catch(error) {
    console.log(error.toString())
  }
}

Array.prototype.indexOfAccNumber = function(id) { //Look at the index of an account number in an Array
  for (var i = 0; i < this.length; i++)
      if (this[i].acc_number === id)
          return i;
  return -1;
}

Array.prototype.indexOfId = function(id) { //Look at the index of an id in an Array
  for (var i = 0; i < this.length; i++)
      if (this[i].id === id)
          return i;
  return -1;
}

main();