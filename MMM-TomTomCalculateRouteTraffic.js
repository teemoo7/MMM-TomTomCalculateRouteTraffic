Module.register("MMM-TomTomCalculateRouteTraffic", {
    defaults: {
        //FIXME: remove this line. https://api.tomtom.com/routing/1/calculateRoute/47.460858,-122.292098:47.595409,-122.328979/json?key=ASs2zMzGT9fWGsQnPO6AnL7gbM9RdXIz
        apiTomTomBaseUrl: "https://api.tomtom.com/routing/1/calculateRoute",
        apiTomTomKey: "",
        refresh: (5 * 60 * 1000),
        routes: [{
            name: "Work Mic",
            from: {latitude: 46.4826157, longitude: 6.7646802},
            to: {latitude: 46.5373436, longitude: 6.556156}
        }],
        animationSpeed: 2000,
    },

    start: function () {
        Log.info(`Starting module: ${this.name}`);
        if (this.config.apiTomTomKey === "") {
            Log.error(`${this.name}: TomTom API key not set. Please read the README.md for details.`);
            return;
        }

        this.calculatedRoutes = [];

        var self = this;
        setInterval(function() {
            self.calculateRoutes();
        }, this.config.refresh);
    },

    getStyles: function () {
        return ["css/MMM-TomTomCalculateRouteTraffic.css"];
    },

    getScripts: function () {
        return [];
    },

    // Override dom generator.
    getDom: function () {
        let wrapper = document.createElement("div");
        let errorDiv = document.createElement("div");
        wrapper.appendChild(errorDiv);

        this.calculatedRoutes.forEach(calculatedRoute => {
            let routeDiv = document.createElement("div");
            //todo: add symbol
            let nameSpan = document.createElement("span");
            nameSpan.className = "bright medium";
            nameSpan.innerHTML = calculatedRoute.route.name;
            routeDiv.appendChild(nameSpan);
            let timeSpan = document.createElement("span");
            timeSpan.className = "bright medium";
            timeSpan.innerHTML = calculatedRoute.calculated.timeMin + " minutes";
            routeDiv.appendChild(timeSpan);
            if (calculatedRoute.calculated.delayMin > 0) {
                let delaySpan = document.createElement("span");
                delaySpan.innerHTML = "(" + calculatedRoute.calculated.delayMin + " minutes delay)" ;
                routeDiv.appendChild(delaySpan);
            }
            let lengthSpan = document.createElement("span");
            lengthSpan.className = "normal small";
            lengthSpan.innerHTML = calculatedRoute.calculated.lengthKm + " km";
            routeDiv.appendChild(lengthSpan);
            wrapper.appendChild(routeDiv);
        });

        return wrapper;
    },

    calculateRoutes: function() {
        //todo: parallel?
        this.calculatedRoutes = [];
        this.config.routes.forEach(route => {
            this.calculateRoute(route);
        });
    },

    calculateRoute: function(route) {
        let locations = `${route.from.latitude},${route.from.longitude}:${route.to.latitude},${route.to.longitude}`;
        let url = `${this.config.apiTomTomBaseUrl}/${locations}/json?key=${this.config.apiTomTomKey}`;

        let self = this;
        let request = new XMLHttpRequest();
        request.open("GET", url, true);
        request.onreadystatechange = function() {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    this.calculatedRoutes.push(self.getCalculatedRoute(JSON.parse(this.response), route));
                } else {
                    //todo: add error message in DOM
                    Log.error(`${this.name}: TomTom API returned an error: ${this.status}`);
                    if (this.status === 400) {
                        Log.error(`${this.name}: TomTom API - Incorrect request (locations)`);
                    } else if (this.status === 403) {
                        Log.error(`${this.name}: TomTom API - Authentication / permissions issue.`);
                    }
                }
                self.updateDom(self.config.animationSpeed);
            }
        };
        request.send();
    },

    getCalculatedRoute: function (jsonBody, route) {
        let summary = jsonBody.routes[0].summary;
        return {
            route: route,
            calculated: {
                lengthKm: summary.lengthInMeters / 1000,
                timeMin: summary.travelTimeInSeconds / 60,
                delayMin: summary.trafficDelayInSeconds / 60,
            }
        };
    },

});
