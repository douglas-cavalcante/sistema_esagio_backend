'use strict'

const Contract = use('App/Models/Contract')

class FinancialReportController {

  async index({ request }) {
    const data = request.get();

    const contractQueryActives = Contract.query()
      .with('company')
      .with('trainee')
      .where("status", true)

    if (data.company_id) {
      contractQueryActives.whereIn("company_id", data.company_id.split(','));
    }

    const actives = await contractQueryActives.fetch();

    const contractQueryInactives = Contract.query()
      .with('company')
      .with('trainee')
      .where("status", false)

    if (data.company_id) {
      contractQueryInactives.whereIn("company_id", data.company_id.split(','));
    }


    if (data.date_start_end_validity && data.date_end_end_validity) {
      contractQueryInactives.whereBetween("date_shutdown", [data.date_start_end_validity, data.date_end_end_validity]);
    }

    const inactives = await contractQueryInactives.fetch();
    return {
      inactivesQtd: inactives.toJSON().length,
      activesQtd: actives.toJSON().length,
      actives,
      inactives,
    };
  }
}

module.exports = FinancialReportController
