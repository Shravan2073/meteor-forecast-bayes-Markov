const socket = io();

const regionCtx = document.getElementById("regionChart").getContext("2d");
const posteriorCtx = document.getElementById("posteriorChart").getContext("2d");
const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

// Initialize charts
let regionChart, posteriorChart, markovChart;

regionChart = new Chart(regionCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Region Meteor Count",
        data: [],
        borderColor: "lime",
        fill: false,
      },
      {
        label: "Predicted Meteor Count",
        data: [],
        borderColor: "blue",
        fill: false,
      },
      {
        label: "Confidence Interval",
        data: [],
        borderColor: "red",
        borderDash: [5, 5],
        borderWidth: 1,
        fill: false,
      },
    ],
  },
});

posteriorChart = new Chart(posteriorCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Bayesian Posterior",
        data: [],
        borderColor: "violet",
        fill: false,
      },
    ],
  },
});

// Markov Chain Chart
const markovCtx = document.getElementById("markovChart").getContext("2d");
markovChart = new Chart(markovCtx, {
  type: "bar",
  data: {
    labels: [], // e.g., ['low', 'medium', 'high']
    datasets: [
      {
        label: "Meteors per Cycle",
        data: [],
        backgroundColor: [],
      },
    ],
  },
  options: {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: 10,
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
      x: {
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
    },
  },
});

// Poll for graph updates every 2 seconds
setInterval(() => {
  socket.emit("get_graph_data");
}, 2000);

socket.on("graph_data", (data) => {
  if (data.markov_data) {
    const { states, rates, current_index } = data.markov_data;

    // Highlight current state
    const colors = states.map((_, i) =>
      i === current_index ? "#ff6b6b" : "#66fcf1"
    );

    markovChart.data.labels = states;
    markovChart.data.datasets[0].data = rates;
    markovChart.data.datasets[0].backgroundColor = colors;
    markovChart.update();
  }

  if (!data || !data.region_counts) return;

  // Calculate labels for both historical and future data
  const historicalLabels = Array.from(
    { length: data.region_counts.length },
    (_, i) => `T${i + 1}`
  );
  const futureLabels = Array.from(
    { length: data.predictions?.length || 0 },
    (_, i) => `T${data.region_counts.length + i + 1}`
  );
  const allLabels = [...historicalLabels, ...futureLabels];

  // Update region counts and predictions
  regionChart.data.labels = allLabels;
  regionChart.data.datasets[0].data = data.region_counts;

  if (data.predictions) {
    // Add null values for historical data in prediction dataset
    const predictionData = Array(data.region_counts.length)
      .fill(null)
      .concat(data.predictions);
    regionChart.data.datasets[1].data = predictionData;

    // Add confidence interval data
    const confidenceData = Array(data.region_counts.length)
      .fill(null)
      .concat(
        data.predictions.map((pred, i) => ({
          x: futureLabels[i],
          y: data.lower_bound[i],
          y1: data.upper_bound[i],
        }))
      );
    regionChart.data.datasets[2].data = confidenceData;

    // Update statistics
    const currentRate = data.region_counts[data.region_counts.length - 1];
    const nextPrediction = data.predictions[0];

    document.getElementById("currentRate").textContent = currentRate
      ? currentRate.toFixed(2)
      : "-";
    document.getElementById("nextPrediction").textContent = nextPrediction
      ? nextPrediction.toFixed(2)
      : "-";
    document.getElementById("confidence").textContent = "95%";
  }

  regionChart.update();

  // Update posterior distribution
  if (data.x && data.y) {
    posteriorChart.data.labels = data.x;
    posteriorChart.data.datasets[0].data = data.y;
    posteriorChart.update();
  }
});

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };

// Colors
const COLORS = {
  sun: "#FFD700",
  planets: ["#FFA500", "#1E90FF", "#FF6347", "#32CD32"],
  moons: ["#B0C4DE", "#FFFFFF", "#C0C0C0"],
  orbit: ["#9370DB", "#00CED1", "#FFC0CB", "#ADFF2F"],
  meteor: "#FFFFFF",
  region: "#FFFF00",
};

// Region of Interest
const REGION = {
  x: CENTER.x - 100,
  y: CENTER.y - 100,
  width: 200,
  height: 200,
};

// Celestial Bodies
class Planet {
  constructor(color, radius, orbitRadius, speed, orbitColor) {
    this.color = color;
    this.radius = radius;
    this.orbitRadius = orbitRadius;
    this.speed = speed;
    this.angle = Math.random() * 2 * Math.PI;
    this.orbitColor = orbitColor;
    this.moons = [];
  }

  updatePosition() {
    this.angle += this.speed;
    this.x = CENTER.x + this.orbitRadius * Math.cos(this.angle);
    this.y = CENTER.y + this.orbitRadius * Math.sin(this.angle);
  }

  draw() {
    // Draw full orbit
    ctx.strokeStyle = this.orbitColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, this.orbitRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw planet with glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw moons
    this.moons.forEach((m) => m.updateAndDraw(this.x, this.y));
  }

  addMoon(moon) {
    this.moons.push(moon);
  }
}

class Moon {
  constructor(color, radius, orbitRadius, speed) {
    this.color = color;
    this.radius = radius;
    this.orbitRadius = orbitRadius;
    this.speed = speed;
    this.angle = Math.random() * 2 * Math.PI;
  }

  updateAndDraw(px, py) {
    this.angle += this.speed;
    const x = px + this.orbitRadius * Math.cos(this.angle);
    const y = py + this.orbitRadius * Math.sin(this.angle);

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

class Meteor {
  constructor() {
    this.x = Math.random() * WIDTH;
    this.y = 0;
    this.speed = Math.random() * 1 + 0.5;
    this.mass = Math.random() * 1 + 0.5;
  }

  fall() {
    const dx = CENTER.x - this.x;
    const dy = CENTER.y - this.y;
    const distance = Math.sqrt(dx ** 2 + dy ** 2) + 0.1;
    const gravity = 100 / distance ** 2;

    this.x += ((gravity * dx) / distance) * this.mass;
    this.y += this.speed + ((gravity * dy) / distance) * this.mass;
  }

  draw() {
    ctx.fillStyle = COLORS.meteor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI);
    ctx.fill();
  }

  isOffScreen() {
    return this.x < 0 || this.x > WIDTH || this.y > HEIGHT;
  }
}

let planets = [
  new Planet(COLORS.planets[0], 8, 60, 0.005, COLORS.orbit[0]),
  new Planet(COLORS.planets[1], 10, 100, 0.004, COLORS.orbit[1]),
  new Planet(COLORS.planets[2], 6, 150, 0.003, COLORS.orbit[2]),
  new Planet(COLORS.planets[3], 7, 200, 0.002, COLORS.orbit[3]),
];

planets[1].addMoon(new Moon(COLORS.moons[0], 3, 15, 0.025));
planets[2].addMoon(new Moon(COLORS.moons[1], 2, 10, 0.035));
planets[3].addMoon(new Moon(COLORS.moons[2], 2, 18, 0.02));

let meteors = [];

function drawSun() {
  ctx.shadowBlur = 20;
  ctx.shadowColor = COLORS.sun;
  ctx.fillStyle = COLORS.sun;
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 20, 0, 2 * Math.PI);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawRegion() {
  ctx.strokeStyle = COLORS.region;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(REGION.x, REGION.y, REGION.width, REGION.height);
  ctx.setLineDash([]);
}

function animate() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawSun();
  drawRegion();

  // Draw planets and moons
  planets.forEach((p) => {
    p.updatePosition();
    p.draw();
  });

  // Add meteors if below limit
  if (meteors.length < 30) {
    for (let i = 0; i < 2; i++) {
      meteors.push(new Meteor());
    }
  }

  // 🔽 ADD THIS RIGHT HERE
  let countInRegion = 0;

  meteors.forEach((meteor, index) => {
    meteor.fall();
    meteor.draw();
    if (meteor.isOffScreen()) {
      meteors.splice(index, 1);
    } else {
      // Check if inside region
      if (
        meteor.x >= REGION.x &&
        meteor.x <= REGION.x + REGION.width &&
        meteor.y >= REGION.y &&
        meteor.y <= REGION.y + REGION.height
      ) {
        countInRegion++;
      }
    }
  });

  // 🔁 Emit to Flask every 30 frames (~1/sec at 30 FPS)
  if (typeof frameCount === "undefined") frameCount = 0;
  frameCount++;
  if (frameCount % 30 === 0) {
    socket.emit("meteor_in_region", { count: countInRegion });
    // Also request updated graph data
    socket.emit("get_graph_data");
  }

  requestAnimationFrame(animate);
}

animate();
