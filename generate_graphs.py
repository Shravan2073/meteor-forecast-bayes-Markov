import matplotlib.pyplot as plt
import numpy as np
import scipy.stats as stats
from datetime import datetime, timedelta

# Configuration
prediction_window = 10
confidence_level = 0.95
window_size = 10

# Generate time points
base_time = datetime.now()
time_points = [base_time + timedelta(minutes=i) for i in range(50)]
future_times = [base_time + timedelta(minutes=i) for i in range(50, 50 + prediction_window)]

# Generate synthetic data
np.random.seed(42)  # For reproducibility
meteor_rate = {"low": 1, "medium": 2, "high": 3}
region_meteor_counts = np.random.poisson(2, 50)
observed_meteors = np.random.poisson(2, 25)

# Calculate predictions and confidence intervals
moving_avg = np.mean(region_meteor_counts[-window_size:])
std_dev = np.std(region_meteor_counts[-window_size:])
z_score = stats.norm.ppf((1 + confidence_level) / 2)
margin = z_score * std_dev / np.sqrt(window_size)

future_predictions = np.random.normal(moving_avg, std_dev, prediction_window)
lower_bound = future_predictions - margin
upper_bound = future_predictions + margin

# Markov Chain Plot
plt.figure(figsize=(10, 6))
plt.bar(meteor_rate.keys(), [meteor_rate[s] for s in meteor_rate.keys()], color=["blue", "green", "red"])
plt.title("Markov Chain: Meteor Arrival Rates")
plt.ylabel("Meteors per cycle")
plt.ylim(0, 10)
plt.grid(True, alpha=0.3)
plt.savefig("static/markov.png", dpi=300, bbox_inches='tight')
plt.close()

# Region Count Plot with Predictions
plt.figure(figsize=(12, 6))
plt.plot(time_points, region_meteor_counts, 'b-', label="Observed Meteors", linewidth=2)
plt.plot(future_times, future_predictions, 'r--', label="Predictions", linewidth=2)
plt.fill_between(future_times, lower_bound, upper_bound, color='r', alpha=0.2, label="95% Confidence Interval")
plt.title("Meteors in Region Over Time with Predictions")
plt.xlabel("Time")
plt.ylabel("Count")
plt.legend()
plt.grid(True, alpha=0.3)
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig("static/region_count.png", dpi=300, bbox_inches='tight')
plt.close()

# Bayesian Posterior Plot
alpha_prior, beta_prior = 2, 1
alpha_post = alpha_prior + sum(observed_meteors)
beta_post = beta_prior + len(observed_meteors)

x_vals = np.linspace(0, 10, 200)
y_vals = stats.gamma.pdf(x_vals, alpha_post, scale=1 / beta_post)

plt.figure(figsize=(10, 6))
plt.plot(x_vals, y_vals, label=f"Posterior α={alpha_post:.2f}, β={beta_post:.2f}", color="purple", linewidth=2)
plt.axvline(x=moving_avg, color='r', linestyle='--', label=f'Current Rate: {moving_avg:.2f}')
plt.title("Bayesian Inference: Posterior Distribution")
plt.xlabel("λ (Meteor Rate)")
plt.ylabel("Density")
plt.legend()
plt.grid(True, alpha=0.3)
plt.savefig("static/posterior.png", dpi=300, bbox_inches='tight')
plt.close()

# Additional Statistics Plot
plt.figure(figsize=(10, 6))
plt.boxplot([region_meteor_counts, future_predictions], 
           labels=['Historical', 'Predicted'],
           patch_artist=True)
plt.title("Distribution Comparison: Historical vs Predicted Meteors")
plt.ylabel("Count")
plt.grid(True, alpha=0.3)
plt.savefig("static/statistics.png", dpi=300, bbox_inches='tight')
plt.close()
