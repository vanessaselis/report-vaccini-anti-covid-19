import { sumDoseX, filterByAreaITA, replaceArea, aggrBy, areaMapping } from "./utils";
import _ from 'lodash';
const baseURL =
  "https://raw.githubusercontent.com/italia/covid19-opendata-vaccini/master/dati";

const sommVaxSummaryURL = `${baseURL}/somministrazioni-vaccini-summary-latest.json`;
const sommVaxDetailURL = `${baseURL}/somministrazioni-vaccini-latest.json`;
const deliveryVaxDetailURL = `${baseURL}/consegne-vaccini-latest.json`;
const vaxSummaryURL = `${baseURL}/vaccini-summary-latest.json`;
const vaxLocationsURL = `${baseURL}/punti-somministrazione-latest.json`;
const anagraficaSummaryURL = `${baseURL}/anagrafica-vaccini-summary-latest.json`;
const puntiSommSummaryURL = `${baseURL}/punti-somministrazione-latest.json`;
const lastUpdateURL = `${baseURL}/last-update-dataset.json`;
const supplierDoses = `${baseURL}/consegne-vaccini-latest.json`;
const elaborate = (data) => {

  const tot = data.dataSommVaxSummary.data
    .filter(filterByAreaITA)
    .reduce(sumDoseX("totale"), 0);
  // datatable and map
  const dataSupplier = data.dataSupplierDoses.data;
  const dataSomeVaxDetail = data.dataSommVaxDetail.data.map(replaceArea);

  const deliverySummary = data.dataVaxSummary.data.map(replaceArea);

  // categories and ages summary
  const categoriesAndAges = data.dataProfileSummary.data;
  const dataVaxSomLatest = data?.dataSommVaxDetail?.data;

  let totalDoses = {
    prima_dose: _.sum(dataVaxSomLatest?.map(e => e?.prima_dose)),
    seconda_dose: _.sum(dataVaxSomLatest?.map(e => e?.seconda_dose)),
    vax_somministrati: _.sum(dataSupplier?.filter((e) => e?.data_consegna?.substr(0, 10) !== '2020-12-27')?.map(_e => _e?.numero_dosi))?.toLocaleString('it')
  }
  const categories = [
    {
      name: "Operatori Sanitari e Sociosanitari",
      code: "categoria_operatori_sanitari_sociosanitari",
      total: dataVaxSomLatest.reduce(
        sumDoseX("categoria_operatori_sanitari_sociosanitari"),
        0
      ),
    },
    {
      name: "Personale non sanitario",
      code: "categoria_personale_non_sanitario",
      total: dataVaxSomLatest.reduce(
        sumDoseX("categoria_personale_non_sanitario"),
        0
      ),
    },
    {
      name: "Ospiti Strutture Residenziali",
      code: "categoria_ospiti_rsa",
      total: dataVaxSomLatest.reduce(sumDoseX("categoria_ospiti_rsa"), 0),
    },
    {
      name: 'Over 80', code: 'categoria_over80',
      total: dataVaxSomLatest.reduce(sumDoseX("categoria_over80"), 0),
    }];

  const dataVaxSomLatestByArea = dataVaxSomLatest.reduce(aggrBy("area"), {});

  const groups = _.groupBy(dataSupplier, 'fornitore');
  let allDosesSupplier = Object.keys(groups).map(k => {
    let groupByKey = groups[k].map(group => group.numero_dosi);
    let sumTotalDoses = _.sum(groupByKey);
    return { totale: sumTotalDoses, fornitore: k, allDoses: groups[k] }
  })

  let totalSuplier = _.sum(allDosesSupplier.map(e => e?.totale));

  let allDosesMapByArea = _.groupBy(dataSupplier, 'area');
  let doesesByArea = Object.keys(allDosesMapByArea).map(area => {

    let groupByArea = allDosesMapByArea[area].map((dose) => dose.numero_dosi);
    let totalDosesByArea = _.sum(groupByArea);
    return { area: areaMapping[area], dosi_somministrate: totalDosesByArea }
  })

  const categoriesByRegionRAW = data.dataSommVaxSummary.data.reduce(
    aggrBy("area"),
    {}
  );

  let categoriesByRegions = {};
  Object.keys(categoriesByRegionRAW).map((x) => {

    categoriesByRegions[x] = [
      {
        name: "Operatori Sanitari e Sociosanitari",
        code: "categoria_operatori_sanitari_sociosanitari",
        total: categoriesByRegionRAW[x].reduce(
          sumDoseX("categoria_operatori_sanitari_sociosanitari"),
          0
        ),
      },
      {
        name: "Personale non sanitario",
        code: "categoria_personale_non_sanitario",
        total: categoriesByRegionRAW[x].reduce(
          sumDoseX("categoria_personale_non_sanitario"),
          0
        ),
      },
      {
        name: "Ospiti Strutture Residenziali",
        code: "categoria_ospiti_rsa",
        total: categoriesByRegionRAW[x]?.reduce(
          sumDoseX("categoria_ospiti_rsa"),
          0
        ),

      },
      {
        name: 'Over 80',
        code: 'categoria_over80',
        total: categoriesByRegionRAW[x]?.reduce(sumDoseX("categoria_over80"), 0),
      }
    ];
    return categoriesByRegions;
  });

  deliverySummary.forEach(ds => {
    if (categoriesByRegions[ds.code]) {
      ds['byCategory'] = categoriesByRegions[ds.code].reduce(
        aggrBy("code"),
        {}
      )
    } else {
      ds['byCategory'] = {
        cat_oss: [{ name: "Operatori Sanitari e Sociosanitari", code: "cat_oss", total: 0 }],
        cat_pns: [{ name: "Personale non sanitario", code: "cat_pns", total: 0 }],
        cat_rsa: [{ name: "Ospiti Strutture Residenziali", code: "cat_rsa", total: 0 }],
        over60: [{ name: "Over 80", code: "over60", total: 0 }]
      }
    }
  })

  const deliveredByArea = _.groupBy(deliverySummary, 'code');

  const locations = data.dataVaxLocations.data.map(replaceArea);

  let maxNumberOfLocations = 0

  const locationsByRegion = _(data.dataVaxLocations.data.map(replaceArea))
    .groupBy('area')
    .map((items, area)=>{
      maxNumberOfLocations = maxNumberOfLocations > items.length ? maxNumberOfLocations : items.length;
      return {area: area, locations: items.length}
    }).value();

  const totalDeliverySummary = _(data.dataSommVaxDetail.data.map(replaceArea))
    .groupBy('code')
    .map((items, code)=>{
      const details = _.head(deliveredByArea[code])
      return ({
        code: code,
        area: _.head(items)?.area, 
        categoria_operatori_sanitari_sociosanitari: _.sumBy(items, 'categoria_operatori_sanitari_sociosanitari'),
        categoria_over80: _.sumBy(items, 'categoria_over80'),
        categoria_ospiti_rsa: _.sumBy(items, 'categoria_ospiti_rsa'),
        categoria_personale_non_sanitario: _.sumBy(items, 'categoria_personale_non_sanitario'),
        byAge: _(items)
                  .groupBy('fascia_anagrafica')
                  .map((rows, age)=>{
                    const dosi_somministrate = _.sumBy(rows, (r)=>r.sesso_maschile + r.sesso_femminile);
                    const percentage = dosi_somministrate/(details.dosi_consegnate || 1);
                    return {
                      age: age,
                      fascia_anagrafica: age,
                      dosi_somministrate,
                      dosi_consegnate: details.dosi_consegnate || 0,
                      percentuale_somministrazione: +(percentage*100).toFixed(1),
                      area: _.head(items)?.area,
                      totale: dosi_somministrate
                  }}).value(),
        sesso_femminile: _.sumBy(items, 'sesso_femminile'),
        sesso_maschile: _.sumBy(items, 'sesso_maschile'),
        dosi_consegnate: details.dosi_consegnate || 0,
        dosi_somministrate: details.dosi_somministrate || 0,
        percentuale_somministrazione: details.percentuale_somministrazione || 0
      })}).value();


    const totalDeliverySummaryByAge = _(data.dataSommVaxDetail.data.map(replaceArea))
      .groupBy(i => i['fascia_anagrafica'].toString().trim())
      .map((rows, age)=>{
        const details = _(rows).groupBy('code').map((rowsData, code)=>{
          const dosi_somministrate = _.sumBy(rowsData, (r)=>r.sesso_maschile + r.sesso_femminile);
          const percentage = dosi_somministrate/(_.head(deliveredByArea[code]).dosi_consegnate || 1);
          return {
            age: age,
            dosi_somministrate,
            sesso_maschile: _.sumBy(rowsData, 'sesso_maschile'),
            sesso_femminile: _.sumBy(rowsData, 'sesso_femminile'),
            code: code,
            dosi_consegnate: _.head(deliveredByArea[code]).dosi_consegnate || 0,
            percentuale_somministrazione: +(percentage*100).toFixed(1),
            area: _.head(rowsData).area,
            //details: rows
          }
        })
        .value()
        return {
          age: age,
          details: details
      }})
      .groupBy('age')
      .value()

  const gender = {
    gen_m: categoriesAndAges.reduce(sumDoseX("sesso_maschile"), 0),
    gen_f: categoriesAndAges.reduce(sumDoseX("sesso_femminile"), 0),
  };

  const timestamp = data.dataLastUpdate.ultimo_aggiornamento;
  const aggr = {
    timestamp,
    tot,
    deliverySummary,
    categoriesAndAges,
    categories,
    categoriesByRegions,
    locations,
    gender,
    dataSomeVaxDetail,
    locationsByRegion,
    maxNumberOfLocations,
    allDosesSupplier,
    doesesByArea,
    totalSuplier,
    totalDoses,
    totalDeliverySummaryByAge,
    totalDeliverySummary
  };
  return aggr;
};

export const loadData = async () => {
  const resSommVaxSummary = await fetch(sommVaxSummaryURL);
  const resSommVaxDetail = await fetch(sommVaxDetailURL);
  const resDeliveryVaxDetail = await fetch(deliveryVaxDetailURL);
  const resVaxSummary = await fetch(vaxSummaryURL);
  const resProfileSummaryURL = await fetch(anagraficaSummaryURL);
  const resPointsSommSummaryURL = await fetch(puntiSommSummaryURL);
  const resVaxLocations = await fetch(vaxLocationsURL);
  const resLastUpdate = await fetch(lastUpdateURL);
  const resSupplierDoses = await fetch(supplierDoses);

  const dataSommVaxSummary = await resSommVaxSummary.json();
  const dataSommVaxDetail = await resSommVaxDetail.json();
  const dataDeliveryVaxDetail = await resDeliveryVaxDetail.json();
  const dataVaxSummary = await resVaxSummary.json();
  const dataProfileSummary = await resProfileSummaryURL.json();
  const dataPointsSommSummary = await resPointsSommSummaryURL.json();
  const dataVaxLocations = await resVaxLocations.json();
  const dataLastUpdate = await resLastUpdate.json();

  const dataSupplierDoses = await resSupplierDoses.json();
  return {
    ...elaborate({
      dataSommVaxSummary,
      dataSommVaxDetail,
      dataDeliveryVaxDetail,
      dataVaxSummary,
      dataProfileSummary,
      dataPointsSommSummary,
      dataLastUpdate,
      dataVaxLocations,
      dataSupplierDoses,
    }),
  };
};
