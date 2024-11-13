Module.register("MMM-TomTomCalculateRouteTraffic", {
	defaults: {
		apiTomTomBaseUrl: "https://api.tomtom.com/routing/1/calculateRoute",
		apiTomTomKey: "",
		refresh: (5 * 60 * 1000),
		animationSpeed: 2000,
		routes: [],
		size: "medium",
		showDelay: true,
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
			numbersSpan.className = "bright " + this.getAdjustedFontClass("large");
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
				delayDiv.className = "delay " + this.getAdjustedFontClass("medium");
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
			nameSpan.innerHTML = calculatedRoute.route.name + " (" + calculatedRoute.calculated.lengthKm + " km)";
			infoDiv.appendChild(nameSpan);

			wrapper.appendChild(routeDiv);
		});

		return wrapper;
	},

	calculateRoutes: function () {
		// Reset the error message
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

	processData: function (jsonBody, route) {
		let summary = jsonBody.routes[0].summary;
		let calculatedRoute = {
			route: route,
			calculated: {
				lengthKm: Math.ceil(summary.lengthInMeters / 1000),
				timeMin: Math.ceil(summary.travelTimeInSeconds / 60),
				delayMin: Math.ceil(summary.trafficDelayInSeconds / 60),
			}
		};
		this.calculatedRoutes.push(calculatedRoute);
	},

	getAdjustedFontClass: function (fontSizeClass) {
		return this.adjustedFontClassMap[this.config.size][fontSizeClass];
	},

});
