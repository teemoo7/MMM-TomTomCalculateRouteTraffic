Module.register("MMM-TomTomCalculateRouteTraffic", {
	defaults: {
		apiTomTomBaseUrl: "https://api.tomtom.com/routing/1/calculateRoute",
		apiTomTomKey: "",
		refresh: (5 * 60 * 1000),
		animationSpeed: 2000,
		routes: [],
		size: "medium",
		showDelay: true,
		showMiles: false,
	},

	adjustedFontClassMap: {
		"small": {
			"small": "xsmall",
			"medium": "small",
			"large": "medium",
		},
		"medium": {
			"small": "small",
			"medium": "medium",
			"large": "large",
		},
		"large": {
			"small": "medium",
			"medium": "large",
			"large": "xlarge",
		},
	},

	start: function () {
		Log.info(`Starting module: ${this.name}`);
		if (this.config.apiTomTomKey === "") {
			Log.error(`${this.name}: TomTom API key not set. Please read the README.md for details.`);
			return;
		}

		this.calculatedRoutes = [];
		this.errorMessage = undefined;

		var self = this;
		setInterval(function () {
			self.calculateRoutes();
		}, this.config.refresh);
		self.calculateRoutes();
	},

	getStyles: function () {
		return ["MMM-TomTomCalculateRouteTraffic.css", "font-awesome.css"];
	},

	getScripts: function () {
		return [];
	},

	getTranslations: function () {
		return {
			en: "translations/en.json",
			fr: "translations/fr.json",
			de: "translations/de.json",
			cs: "translations/cs.json",
			es: "translations/es.json",
		};
	},

	getDom: function () {
		let wrapper = document.createElement("div");

		if (this.errorMessage !== undefined) {
			let errorDiv = document.createElement("div");
			errorDiv.className = "error";
			errorDiv.innerHTML = "ERROR: " + this.errorMessage;
			wrapper.appendChild(errorDiv);
		}

		this.calculatedRoutes.forEach(calculatedRoute => {
			let routeDiv = document.createElement("div");
			routeDiv.className = "route";

			let travelDiv = document.createElement("div");
			routeDiv.appendChild(travelDiv);

			let timeDiv = document.createElement("div");
			let numbersSpan = document.createElement("span");
			numbersSpan.className = "bright " + this.getAdjustedFontClass("medium");
			numbersSpan.innerHTML = calculatedRoute.calculated.timeMin;
			timeDiv.appendChild(numbersSpan);
			let minutesSpan = document.createElement("span");
			minutesSpan.className = "normal " + this.getAdjustedFontClass("medium");
			minutesSpan.innerHTML = " " + this.translate("minutes");
			timeDiv.appendChild(minutesSpan);
			travelDiv.appendChild(timeDiv);
			if (this.config.showDelay && calculatedRoute.calculated.delayMin > 0) {
				let delayDiv = document.createElement("div");
				delayDiv.innerHTML = "(" + this.translate("including minutes delay", {"delayInMinutes": calculatedRoute.calculated.delayMin}) + ")";
				delayDiv.className = "delay " + this.getAdjustedFontClass("small");
				travelDiv.appendChild(delayDiv);
			}

			let infoDiv = document.createElement("div");
			routeDiv.appendChild(infoDiv);

			if (calculatedRoute.route.symbol !== undefined) {
				let symbolSpan = document.createElement("span");
				symbolSpan.className = `fa fa-${calculatedRoute.route.symbol} symbol`;
				infoDiv.appendChild(symbolSpan);
			}
			let nameSpan = document.createElement("span");
			nameSpan.className = "normal " + this.getAdjustedFontClass("small");
			nameSpan.innerHTML = calculatedRoute.route.name + " (" + calculatedRoute.calculated.lengthMi + " mi)";
			infoDiv.appendChild(nameSpan);

			let etaSpan = document.createElement("span");
			etaSpan.className = "normal " + this.getAdjustedFontClass("small");
			etaSpan.innerHTML = "ETA: " + calculatedRoute.calculated.ETA;
			routeDiv.appendChild(etaSpan);

			wrapper.appendChild(routeDiv);
		});

		return wrapper;
	},

	calculateRoutes: function () {
		this.errorMessage = undefined;
		this.calculatedRoutes = [];
		this.config.routes.forEach(route => {
			this.calculateRoute(route);
		});
	},

	calculateRoute: function (route) {
		let locations = `${route.from.latitude},${route.from.longitude}:${route.to.latitude},${route.to.longitude}`;
		let url = `${this.config.apiTomTomBaseUrl}/${locations}/json?key=${this.config.apiTomTomKey}`;

		let self = this;
		let request = new XMLHttpRequest();
		request.open("GET", url, true);
		request.onreadystatechange = function () {
			if (this.readyState === 4) {
				if (this.status === 200) {
					self.processData(JSON.parse(this.response), route);
				} else {
					var errorMessage = `${self.name}: TomTom API returned an error: ${this.status}. `;
					if (this.status === 400) {
						errorMessage += "Incorrect request (locations)";
					} else if (this.status === 403) {
						errorMessage += "Authentication / permissions issue";
					}
					Log.error(errorMessage);
					self.errorMessage = errorMessage;
				}
				self.updateDom(self.config.animationSpeed);
			}
		};
		request.send();
	},

	/**
	 * 
	 * @param {number} meters 
	 * @returns number
	 */
	convertMetersToMiles: function(meters) {
		
		const conversionFactor = 0.0006213712; // Conversion factor from meters to miles
		const miles = meters * conversionFactor; // Convert meters to miles
		const lengthInMiles = Math.round(miles * 10) / 10;

		return lengthInMiles
	},

	/**
	 * 
	 * @param {number} min 
	 * @returns string
	 */
	calculateEstimatedTimeOfArrival: function(min){
		// Get current time
		const now = new Date();
		
		// Add estimated minutes to the current time
		now.setMinutes(now.getMinutes() + min);
		
		// Format the time of arrival (HH:MM AM/PM)
		const hours = now.getHours();
		const minutes = now.getMinutes();
		const ampm = hours >= 12 ? 'PM' : 'AM';
		
		// Convert 24-hour time to 12-hour format
		const hours12 = hours % 12;
		const displayHours = hours12 === 0 ? 12 : hours12;  // Handle midnight and noon case
		const displayMinutes = minutes < 10 ? '0' + minutes : minutes; // Ensure 2 digits for minutes
		
		// Construct the final ETA string
		const eta = `${displayHours}:${displayMinutes} ${ampm}`;
		
		return eta;
	},

	processData: function (jsonBody, route) {
		let summary = jsonBody.routes[0].summary;

		const lengthInMiles = this.convertMetersToMiles(summary.lengthInMeters);
		const timeInMinutes = Math.ceil(summary.travelTimeInSeconds / 60);
		const ETA = this.calculateEstimatedTimeOfArrival(timeInMinutes);


		let calculatedRoute = {
			route: route,
			calculated: {
				ETA: ETA,
				lengthMi: lengthInMiles,
				lengthKm: Math.ceil(summary.lengthInMeters / 1000),
				timeMin: timeInMinutes,
				delayMin: Math.ceil(summary.trafficDelayInSeconds / 60),
			}
		};
		this.calculatedRoutes.push(calculatedRoute);
	},

	getAdjustedFontClass: function (fontSizeClass) {
		return this.adjustedFontClassMap[this.config.size][fontSizeClass];
	},

});
