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
  let data = await response.json()
  return data
}

/**
 * @description Trying to get the access token
 * @return the acces token
 */
async function getAccessToken() {
  try {
    var refreshToken = await getRefreshToken().then(data => data.refresh_token);

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
    return data
  } catch(error) {
    console.log(error);
  }
}

var dataAccounts = [];
/**
 * @description Fetch accounts recursively
 * @param {Number} page Number of the page
 * @param {String} accessToken Access token to get the data needed
 * @return all of the accounts
 */
async function getAccounts(page=1, accessToken=null) {
  try {
    if ( !accessToken){
      var accessToken = await getAccessToken().then(data => getAccounts(page, data.access_token));  
      return accessToken
    } else {
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
      var data = await response.json();
      let hasNextPage = data.link.next;
      if (!hasNextPage) {
        dataAccounts = dataAccounts.concat(data.account);
        return dataAccounts
      } else {
        let nextPagesAccounts = await getAccounts(page + 1, (accessToken || null));
        dataAccounts = data.account.concat(dataAccounts);
        return dataAccounts
      } 
    }    
  } catch(error) {
    console.log(error);
  }
}



/**
 * @description Fetch all transactions from an account recursively
 * @param {String} id Account id 
 * @param {Number} page Number of the page
 * @param {String} accessToken Number of the page
 * @return All of the transactions related to an account
 */
async function getTransactions(id, page=1, accessToken){
  try {
    if ( !accessToken){
      var accessToken = await getAccessToken().then(data => getTransactions(id, page, data.access_token));  
      return accessToken
    } else if (!id){
      return null      
    } else {
      var dataTransactions = [];
      console.log(`--- Fetch Transaction page n°${page} of Account n°${id} ---`)
      let response = await fetch(
        'http://localhost:3000/accounts/' + id + '/transactions?' + `page=${page}` ,
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
      let hasNextPage = data.link.next;
      if (!hasNextPage) {
        data.transactions = data.transactions.filter((v,i,a) => a.indexOfId(v.id)=== i).map(e => (e.sign === "DBT" ? changeSign(e,true) : changeSign(e, false)));
        dataTransactions = dataTransactions.concat(data.transactions);
        return dataTransactions
      } else {
        await getTransactions(id,page + 1, (accessToken || null)).then(res =>{
          dataTransactions = dataTransactions.concat(data.transactions);
          dataTransactions = dataTransactions.filter((v,i,a) => a.indexOfId(v.id)=== i).map(e => (e.sign === "DBT" ? changeSign(e,true) : changeSign(e, false)));
        })
        return dataTransactions
      }
    }
  } catch(error) {
    console.log(error.toString(), `--- Error with account id n°${id} at page n°${page}`)
  }
}

/**
 * @description Change the transaction's amount depending of the sign of it (i.e CDT or DBT) and filter the data in the format needed
 * @param {Array} transaction transaction to process
 * @param {String} boolean boolean to tell us if we have to change it or not
 * @return a transaction process in the required format
 */
function changeSign(transaction, boolean) {
  if (!boolean) { let transactionInfo = {"label": transaction.label, "amount": transaction.amount, "currency": transaction.currency}; return transactionInfo}
  else {let transactionInfo = {"label": transaction.label, "amount": "-" + transaction.amount, "currency": transaction.currency}; return transactionInfo}
}

var transactions = [], accountsDone=[];
/**
 * @description Parse all the transactions and accounts, and process the data.
 * @param {Array} accounts Accounts to process
 * @param {Int} i i is a pointer of the account we are processing in accounts -> accounts[i]
 * @param {String} accessToken A token required to access the data
 * @return All of the transactions parse in the format asked
 */
async function parseTransactions(accounts=[],i=0 ,accessToken = null) {
  try {
    if ( !accessToken){
      var accessToken = await getAccessToken().then(data => parseTransactions(accounts,i=0, data.access_token));  
    }
    else if(accounts.length == 0) {
      accounts = await getAccounts(page=1, accessToken).then((data) => {
        var uniqueAccount = data.filter((v, i, a) => a.indexOfAccNumber(v.acc_number) === i); 
        parseTransactions(accounts=uniqueAccount,i=0, accessToken)
      })
    } else {
      if (i<accounts.length && (!accountsDone.includes(accounts[i]))) {
        await getTransactions(accounts[i].acc_number,page=1, (accessToken || null)).then(res =>{
                transactions.push({"acc_number": accounts[i].acc_number, "amount": accounts[i].amount, "transactions": res})
                accountsDone.push(accounts[i])
              }).then(res => parseTransactions(accounts, i+1, accessToken))  
      } else if(i< accounts.length) {
        parseTransactions(accounts, i+1, accessToken)
      }else {
        let disp = transactions.map(e => console.log(e))
        return transactions
      }
    }
  } catch(error) {
    console.log(error);
  }
}

Array.prototype.indexOfAccNumber = function(id) {
  for (var i = 0; i < this.length; i++)
      if (this[i].acc_number === id)
          return i;
  return -1;
}

Array.prototype.indexOfId = function(id) {
  for (var i = 0; i < this.length; i++)
      if (this[i].id === id)
          return i;
  return -1;
}

parseTransactions()

// La fonction ci-dessous fonctionne et renvoie bien ce que l'on cherche, cependant je n'ai pas encore trouvé l'origine du problème. Le code reponse de la requête est 400. Cependant l'accesstoken est le bon et le compte "000000013" existe bel et bien.
// getTransactions("000000013", page=1, null).then(res => console.log(res))