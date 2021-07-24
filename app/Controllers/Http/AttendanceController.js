'use strict'

const Helpers = use('Helpers')

let excelToJson = require('convert-excel-to-json');


const Attendance = use('App/Models/Attendance')

const groupBy = (key) => {
  return function group(array) {
    return array.reduce((acc, obj) => {
      const property = obj[key];
      acc[property] = acc[property] || [];
      acc[property].push(obj);
      return acc;
    }, {});
  };
}

class AttendanceController {


  async index({ request, response }) {

    const params = request.get();

    const data = await Attendance.query().where('cpf', params.cpf).fetch()

    return data
  }


  async store({ request, response }) {

    try {

      const params = request.get();

      const file = request.file('file')

      await file.move(Helpers.tmpPath('uploads'), {
        name: 'presencas-file.xlsx',
        overwrite: true
      })

      if (!file.moved()) {
        return file.error()
      }

      const json = excelToJson({
        sourceFile: Helpers.tmpPath('/uploads/presencas-file.xlsx')
      });

      const firstKey = Object.keys(json)[0].toString()


      const parseJSON = json[firstKey].map(item => {

        const cpfLength = item['B'].toString().length;
        let currentCpf = item['B'].toString();

        for (let index = cpfLength; index < 11; index++) {
          currentCpf = '0' + currentCpf;
        }

        return {
          cpf: currentCpf,
          date: (item['E'] === 'NULL' || item['E'] === null)
            ? ''
            : new Date(item['E'].toString().replace(/"/g, '').substring(0, 10))
        }
      })

      const filterJSON = parseJSON.filter(item => item.cpf.length === 11 && item.date)

      const groupDocument = groupBy('cpf');

      const data = groupDocument(filterJSON);

      const keys = Object.keys(data);

      keys.forEach(async key => {
        const currentData = data[key];
        const ordenedItems = currentData.slice().sort((a, b) => b.date - a.date)
        await Attendance.findOrCreate({
          cpf: ordenedItems[0].cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
          date: ordenedItems[0].date,
        },
          {
            cpf: ordenedItems[0].cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
            date: ordenedItems[0].date,
            type: params.type
          });
      });

    } catch (error) {
      return response
        .status(error.message)
        .send(error)
    }
  }

}


module.exports = AttendanceController
