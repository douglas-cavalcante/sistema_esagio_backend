'use strict'

const Helpers = use('Helpers')
const Contract = use('App/Models/Contract')
let excelToJson = require('convert-excel-to-json');

const {isValid} = require('date-fns')
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

      const traineesContractValid = await Contract
      .query()
      .with('trainee')
      .where("status", true)
      .fetch();

      const parseArrayTraineesContractValid = traineesContractValid.toJSON().reduce((acc, current) => {
       return [...acc, current.trainee.cpf]
      }, []);

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

        const parseDate = new Date(item['E'].toString().replace(/"/g, ''));

        const dateIsValid = isValid(parseDate)

        return {
          cpf: currentCpf,
          date: dateIsValid ? parseDate : ''
        }
      })

      const filterJSON = parseJSON.filter(item => (item.cpf.length === 11) && item.date)

      const groupDocument = groupBy('cpf');

      const data = groupDocument(filterJSON);

      const keys = Object.keys(data);


      const rows = keys.map( async key => {

        const currentData = data[key];

        const ordenedItems = currentData.slice().sort((a, b) => b.date - a.date);

        const formattedCpf = ordenedItems[0].cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")

        if(!parseArrayTraineesContractValid.includes(formattedCpf)) {
          return {
            invalid: true
          }
        }

        const attendanceExists = await Attendance.findBy({
          cpf: ordenedItems[0].cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
          date: ordenedItems[0].date,

        })

        if(attendanceExists) {
          return {
            invalid: false,
            attendance: attendanceExists,
            exists: true
          };
        }

        const attendance = await Attendance.create(
          {
            cpf: ordenedItems[0].cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
            date: ordenedItems[0].date,
            type: params.type
          }
        );

        return {
          invalid: false,
          attendance,
          exists: false
        };
      });

      const result = await Promise.all(rows);

      return {
        count: result.filter(item => item.invalid === false)
      }

    } catch (error) {
      return response
        .status(error.status)
        .send(error.message)
    }
  }

}


module.exports = AttendanceController
