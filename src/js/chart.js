import * as d3 from 'd3';
import * as topojson from 'topojson';
import _ from 'lodash';
import regression from 'regression';


// This is the chart function that will be exported
export default () => ({

  // Develop the reusable function for you chart in this init function.
  // cf. https://bost.ocks.org/mike/chart/
  init: function() {

    // Default chart properties
    let geoData = [];

    // Inner chart function
    function chart(selection){
      selection.each(function(data){

        const margins = {
          top: 85,
          right: 30,
          left: 40,
          bottom: 30
        };
        const bbox = this.getBoundingClientRect();
        const width = bbox.width;
        const height = bbox.height - 80;
        const innerWidth = width - margins.right - margins.left;
        const innerHeight = height - margins.top - margins.bottom;

        const t = d3.transition()
            .duration(750);
        const percent = d3.format('+.0%');

        const formatYear = d3.timeFormat("'%y");
        const parseYear = d3.timeParse("%Y");

        // Minimap scales and translations
        const counties_geo = topojson.feature(geoData, geoData.objects.tx_counties)
        const projection = d3.geoAlbers()
              .scale(1)
              .translate([0, 0]);
        const path = d3.geoPath()
              .projection(projection);
        const minimapHeight = 120;
        const minimapWidth = 120;
        const b = path.bounds(counties_geo);
        const scale = 0.95 / Math.max((b[1][0] - b[0][0]) / minimapWidth, (b[1][1] - b[0][1]) / minimapHeight);
        const trans = [(minimapWidth - scale * (b[1][0] + b[0][0])) / 2, (minimapHeight - scale * (b[1][1] + b[0][1])) / 2];

        projection
           .scale(scale + 0.2)
           .translate(trans);

        // DATA PREP
        const demRawData = _.filter(data.DEM.contested.returns, (o) => o.mean !== null);
        const repRawData = _.filter(data.REP.contested.returns, (o) => o.mean !== null);

        const demUncontestData = _.sortBy(_.filter(data.DEM.uncontested.returns, (o) => o.year !== '2016'),['year']);
        const repUncontestData = _.sortBy(_.filter(data.REP.uncontested.returns, (o) => o.year !== '2016'),['year']);

        const dataPrep = (o) => ({
          x: parseYear(o.year),
          y: o.mean,
          y0: o.mean - (1 * o.stdev),
          y1: o.mean + (1 * o.stdev),
          year: parseInt(o.year),
        });

        const demData = _.sortBy(_.map(demRawData, dataPrep), ['x']);
        const repData = _.sortBy(_.map(repRawData, dataPrep), ['x']);

        // CHART AXES
        const xScale = d3.scaleLinear()
            .domain(d3.extent(demData,(o) => o.x))
            .range([0, innerWidth]);
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(formatYear)
            .tickValues((() => _.map(demData, (o) => o.x))())
            .tickPadding(0);
        const yScale = d3.scaleLinear()
            .domain([1, 0])
            .range([0, innerHeight]);
        const yAxis = d3.axisLeft(yScale)
            .tickFormat((d) => `${(Math.round(Math.abs(d * 100)))}%`)
            .ticks(4)
            .tickSize(-innerWidth - 40)
            .tickPadding(0);


        // STATS
        const statRun = (data) => regression(
          'linear',
          _.map(data, (d) => [d.year, d.y])
        );

        const demSlope = statRun(demData).equation[0];
        const repSlope = statRun(repData).equation[0];
        const trend = repSlope - demSlope;


        // All appends not in an update pattern...
        const furniture = () => {
          d3.select(this).append("h3");

          const svg = d3.select(this).append("svg")
                        .style("display", "block")
                        .style("margin", "auto");
          const g = svg.append("g").attr("class", "chart")
            .attr("transform", `translate(${margins.left}, ${margins.top})`);

          svg.append("g").attr("class", "minimap");

          g.append("g")
              .attr("class", "y axis")
              .attr("transform", "translate(-35, 0)")
            .append("text")
              .attr("class", "label")
              .attr("x", 0)
              .attr("y", -12)
              .style("text-anchor", "start")
              .text("Average percent of vote");
          g.append("g")
              .attr("class", "x axis")
            .append("text")
              .attr("class", "label")
              .style("text-anchor", "end")
              .text("General elections");

          d3.select(this).append('p')
              .attr("class", "footnote")
              .html(`<span class='stdev-key rep'></span> <span class='stdev-key dem'></span> Standard deviation from the average`)

          d3.select(this).append('p')
              .attr("class", "footnote")
              .text(`Data aggregates all contested race results collected by
                the Secretary of State in general elections.`)

          d3.select(this).append('div')
            .attr('class','trendLab')
            .html('Net annual trend: <span></span>');
        }


        // Check if we've already appended our SVG.
        if (d3.select(this).select("svg").size() < 1) {
          furniture();
        }

        d3.select(this).select("h3").text(`${data.name} county`);

        d3.select(this).select(".trendLab").select('span')
          .attr('class', () => trend >= 0 ? 'rep' : 'dem')
          .text(() => trend >= 0 ? `R ${percent(trend)}` : `D ${percent(Math.abs(trend))}`);


        const svg = d3.select(this).select('svg')
              .attr("width", width)
              .attr("height", height);

        const g = svg.select('g.chart');
        const mapG = svg.select('g.minimap')
          .attr("transform", `translate(${innerWidth - 20 - minimapWidth / 2}, 0)`);

        const yAxisG = g.select('.y.axis');

        const xAxisG = g.select('.x.axis')
            .attr("transform",`translate(0,${innerHeight})`);

        xAxisG.select("text.label")
          .attr("x", innerWidth + 6)
          .attr("y", -3);


        const counties = mapG.selectAll("path")
            .data(counties_geo.features, (d)=> d.id);

        counties.enter().append('path') // Enter
          .merge(counties) // Enter + Update
            .attr('d', path)
            .style('fill',(d) => d.id.toString() === data.code ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.1)')
            .style('stroke-width', 0)
            .attr('class', (d) => `county ${d.id}`);

        yAxisG.call(yAxis);
        xAxisG.call(xAxis);

        const line = d3.line()
          .x((d) => xScale(d.x))
          .y((d) => yScale(d.y))
          .curve(d3.curveCardinal);
        const area = d3.area()
          .x((d) => xScale(d.x))
          .y0((d) => yScale(d.y0))
          .y1((d) => yScale(d.y1))
          .curve(d3.curveCardinal);

        const stdevAreas = g.selectAll("path.stdev")
          .data([demData, repData]);

        stdevAreas.enter().append("path")
          .attr("class", (d,i) => i === 0 ? "stdev dem" : "stdev rep")
        .merge(stdevAreas)
          .transition(t)
          .attr("d", area);

        const voteLines = g.selectAll("path.line")
          .data([demData, repData]);

        voteLines.enter().append("path")
          .attr("class", (d, i) => i === 0 ? "line dem" : "line rep")
        .merge(voteLines)
          .attr("d", line)
          .attr("stroke-dasharray", function(){
            return `${this.getTotalLength()} ${this.getTotalLength()}`;
          })
          .attr("stroke-dashoffset", function(){
            return `${this.getTotalLength()}`;
          })
          .transition(t)
            .attr("stroke-dashoffset", 0);


        // UNCOMMENT FOLLOWING TO ADD a nice wilkinson dot plot for uncontested
        // races that didn't make the editor's cut...

        // const uncontestedR = g.selectAll("g.uncontestedR")
        //   .data(repUncontestData , (d) => d.year);
        //
        // uncontestedR.enter().append("g")
        //   .attr("class", "uncontestedR");
        //
        // uncontestedR.exit().remove();
        //
        // const circlesR = uncontestedR.selectAll("circle.uncontestedR")
        //   .data((d) => d.count === 0 ? [] : _.map(d3.range(d.count), (o) => ({
        //     count: o,
        //     year: parseYear(d.year),
        //   })));
        //
        // circlesR.enter().append("circle")
        //     .attr('class', 'uncontestedR')
        //     .attr('r', 4)
        //     .attr('cy', innerHeight)
        //   .merge(circlesR)
        //     .attr('cx',(d) => xScale(d.year) - 4)
        //     .transition(t)
        //     .attr('cy', (d, i) => innerHeight - (i * 9) - 3);
        //
        // circlesR.exit()
        // .transition(t)
        // .attr('cy', innerHeight + 40)
        // .remove();
        //
        // const uncontestedD = g.selectAll("g.uncontestedD")
        //   .data(demUncontestData , (d) => d.year);
        //
        // uncontestedD.enter().append("g")
        //   .attr("class", "uncontestedD");
        //
        // uncontestedD.exit().remove();
        //
        // const circlesD = uncontestedD.selectAll("circle.uncontestedD")
        //   .data((d) => d.count === 0 ? [] : _.map(d3.range(d.count), (o) => ({
        //     count: o,
        //     year: parseYear(d.year),
        //   })));
        //
        // circlesD.enter().append("circle")
        //     .attr('class', 'uncontestedD')
        //     .attr('r', 4)
        //     .attr('cy', innerHeight)
        //   .merge(circlesD)
        //     .attr('cx',(d) => xScale(d.year) + 4)
        //     .transition(t)
        //     .attr('cy', (d, i) => innerHeight - (i * 9) - 3);
        //
        // circlesD.exit()
        // .transition(t)
        // .attr('cy', innerHeight + 40)
        // .remove();

      });
    }

    // Getter-setters
    chart.geoData = function(_){
      if (!arguments.length) return geoData;
      geoData = _;
      return chart;
    };

    return chart;
  },


  // This function actually draws the chart using the
  // reusable init function.
  draw: function(){
    const chart = this.init()
        .geoData(this._geoData);

    d3.select(this._selection)
      .datum(this._data)
      .call(chart);
  },

  // Call this function to initially create the chart.
  create: function(selection, data, geoData){
    this._selection = selection;
    this._data = data;
    this._geoData = geoData;

    this.draw();
  },

  // This updates the data and elements.
  update: function(data){
    this._data = data;
    this.draw();
  },
  // Simple resize
  resize: function(){
    this.draw();
  },
});
