/**
 * Review du fichier
 * 
 * Ligne 53: Je ne connais pas le formats des mouvements traités. Mais si à une certaine page les mouvements peuvent avoir une date différente alors à priori on ne traite 
 * pas les mouvements de cette page ayant une date correct.
 * 
 * Ligne 57: Même pour un tableau vide, if([]) -> true, donc on ne pourra pas avoir le cas du else qui renvoie une erreur de liste vide à la ligne 64
 * 
 * Ligne 74: Il me semble que le return ne pourra jamais être appellé au vu de la structure if/else du programme
 */
var domain = "bank.local.fr"

/**
 * @description Fetch transactions recursively
 * @param {string} fromDate The maximum date of transactions to return
 * @param {string} authorization Authorization header to authent the user
 * @param {jws} jws Jws token, mandatory if we get one from login request
 * @param {Number} id Account id
 * @param {Number} page Number of the page
 * @param {Object} previousTransactions Previous page of transactions (To ckeck for dupes)
 * @return {Object} All transactions available on the page
 */
async function fetchTransactions(fromDate, authorization, jws = null, id, page, previousTransactions) {
	console.log(`--- Fetch Trasactions page n°${page} ---`);
	try {
    var headers = {"Authorisation":  authorization }

    if (jws) {
      headers = {
        "Authorisation": authorization,
        "jws": jws,
        "Content-type": "application/json",
        "Accept": "application/json"
      }
    } else {
      headers = {
        "Authorisation": authorization,
        "Content-type": "application/json",
        "Accept": "application/json",
      }
    }

	  var {code, response } = await doRequest('GET',
      domain + '/accounts/'+ id + '/transactions?' + `page=${page}`,
      headers);


		if (response && code == 200 && response.data) {
      if (response.data.meta) {
        if (response.data.meta.hasPageSuivante) {
          let mouvements = response.data.Mouvements;
          var date = mouvements[mouvements.length -1].dateValeur;
          if (date <= fromDate) {
            console.log("FromDate is Reached - we don't need more transaction");
          } else {
            // if we have mouvements
            if (mouvements) {
              if (assertTransactions(mouvements)) {
                return [];
              } else {
                console.log(`Push transactions from page ${page}`);
              }
            } else {
              throw new Error("Empty list of transactions ! " + JSON.stringify(previousTransactions));
            }
            let nextPagesTransactions = fetchTransactions(fromDate, authorization, (jws || null), id, page + 1, mouvements);
            response.data.Mouvements = mouvements.concat(nextPagesTransactions);
          }
        }
      }
      return response.data.Mouvements;
    } else throw new Error();

    return [];
	} catch (err) {
		throw new CustomError({
      function: 'fetchTransactions',
			statusCode: 'CRASH',
			rawError: e,
		});
	}
}
