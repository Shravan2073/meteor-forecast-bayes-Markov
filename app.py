from flask import Flask, render_template, jsonify, send_file
from flask_socketio import SocketIO
import numpy as np
import scipy.stats as stats
from collections import deque
import time
import matplotlib.pyplot as plt
import io

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')

# Use deque for efficient rolling window
region_counts = deque(maxlen=100)
observed_meteors = deque(maxlen=100)
alpha_prior, beta_prior = 2, 1

states = ["low", "medium", "high"]
transition_matrix = np.array([
    [0.6, 0.3, 0.1],
    [0.2, 0.5, 0.3],
    [0.1, 0.3, 0.6],
])
current_state = 1  # Start in "medium"
meteor_rate = {"low": 1, "medium": 3, "high": 7}


# Prediction parameters
prediction_window = 10
confidence_level = 0.95

def calculate_predictions(historical_data):
    if len(historical_data) < 2:
        return None, None, None
    
    # Calculate moving average
    window_size = min(10, len(historical_data))
    moving_avg = np.mean(list(historical_data)[-window_size:])
    
    # Calculate prediction interval
    std_dev = np.std(list(historical_data)[-window_size:])
    z_score = stats.norm.ppf((1 + confidence_level) / 2)
    margin = z_score * std_dev / np.sqrt(window_size)
    
    # Generate future predictions
    future_predictions = np.random.normal(moving_avg, std_dev, prediction_window)
    lower_bound = future_predictions - margin
    upper_bound = future_predictions + margin
    
    return future_predictions, lower_bound, upper_bound

def send_updated_data():
    predictions, lower_bound, upper_bound = calculate_predictions(region_counts)
    alpha_post = alpha_prior + sum(observed_meteors)
    beta_post = beta_prior + len(observed_meteors)
    x_vals = np.linspace(0, 10, 100)
    y_vals = list(stats.gamma.pdf(x_vals, alpha_post, scale=1 / beta_post))

    socketio.emit('graph_data', {
        'region_counts': list(region_counts),
        'x': list(x_vals),
        'y': y_vals,
        'predictions': predictions.tolist() if predictions is not None else None,
        'lower_bound': lower_bound.tolist() if lower_bound is not None else None,
        'upper_bound': upper_bound.tolist() if upper_bound is not None else None,
        'timestamp': time.time(),
        'markov_data': {
            'states': list(states),
            'rates': [int(meteor_rate[s]) for s in states],  # ensure native int
            'current_index': int(current_state)              # ensure native int
        }
    })


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@socketio.on('meteor_in_region')
def handle_meteor(data):
    count = data.get('count', 0)
    timestamp = time.time()
    
    if count > 0:
        region_counts.append(count)
        global current_state
        current_state = np.random.choice([0, 1, 2], p=transition_matrix[current_state])

        observed_meteors.append(count)
        send_updated_data()

@socketio.on('get_graph_data')
def send_graph_data():
    send_updated_data()

@app.route('/plot/markov')
def plot_markov():
    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(states, [meteor_rate[s] for s in states], color=["blue", "green", "red"])
    bars[current_state].set_edgecolor('black')
    bars[current_state].set_linewidth(3)

    ax.set_title("Markov Chain: Meteor Arrival Rates")
    ax.set_ylabel("Meteors per cycle")
    ax.set_ylim(0, 10)
    ax.grid(True, alpha=0.3)

    buf = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buf, format="png")
    buf.seek(0)
    plt.close(fig)
    return send_file(buf, mimetype='image/png')


if __name__ == '__main__':
    # Initialize with some data
    for _ in range(10):
        region_counts.append(np.random.poisson(2))
        observed_meteors.append(np.random.poisson(2))
    
    socketio.run(app, debug=True)
