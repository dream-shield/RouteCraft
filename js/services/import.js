/**
 * @fileoverview Service for batch importing places from free-form text.
 * Supports multiple parsing strategies and handles batch geocoding.
 */

window.RouteCraft = window.RouteCraft || {};

(function importModule() {
  const RC = window.RouteCraft;

  /**
   * Simple parser that treats each line as a separate place search.
   * @param {string} text - The raw text to parse.
   * @returns {string[]} A list of place queries.
   */
  const lineByLineParser = (text) => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  };

  /**
   * The ImportService manages different parsers and orchestrates the geocoding process.
   */
  RC.ImportService = {
    parsers: {
      'line-by-line': lineByLineParser,
      // Future parsers like 'llm' or 'web-llm' can be added here.
    },

    /**
     * Processes text using a specific parser and geocodes the resulting queries.
     * @param {string} text - The input text to parse.
     * @param {string} [parserName='line-by-line'] - The name of the parser to use.
     * @returns {Promise<Object[]>} A promise resolving to a list of geocoded results.
     */
    async process(text, parserName = 'line-by-line') {
      const parser = this.parsers[parserName];
      if (!parser) {
        console.error(`Parser "${parserName}" not found.`);
        return [];
      }

      const queries = parser(text);
      if (!queries.length) return [];

      const dayMarkerRegex = /^Day\s*(\d+)$/i;
      const separatorRegex = /^---$|^===$/;
      const dateRegex = /^(\d{1,4})[\/\-](\d{1,2})(?:[\/\-](\d{1,4}))?$/;

      // Process queries in parallel, but handle each result individually
      const results = await Promise.all(queries.map(async (query) => {
        // Check for day markers, separators, or dates first
        const dayMatch = query.match(dayMarkerRegex);
        const sepMatch = query.match(separatorRegex);
        const dateMatch = query.match(dateRegex);

        if (dayMatch || sepMatch || dateMatch) {
          let dateStr = null;
          let title = query;

          if (dateMatch) {
            const now = new Date();
            let y, m, d;
            
            // Basic heuristic: if first part is 4 digits, it's year.
            if (dateMatch[1].length === 4) {
              [y, m, d] = [parseInt(dateMatch[1]), parseInt(dateMatch[2]), parseInt(dateMatch[3] || 1)];
            } else {
              [m, d, y] = [parseInt(dateMatch[1]), parseInt(dateMatch[2]), parseInt(dateMatch[3] || now.getFullYear())];
              if (y < 100) y += 2000;
            }

            try {
              const date = new Date(y, m - 1, d);
              if (!isNaN(date.getTime())) {
                dateStr = date.toISOString().split('T')[0];
                title = `Date: ${dateStr}`;
              }
            } catch (e) {
              console.error("Failed to parse date marker:", query);
            }
          }

          return {
            originalQuery: query,
            found: true,
            isDayMarker: true,
            title: title,
            displayName: dateStr ? `New day on ${dateStr}` : "New day marker",
            date: dateStr,
            lat: null,
            lon: null
          };
        }

        try {
          const suggestions = await RC.fetchSuggestions(query);
          if (suggestions && suggestions.length > 0) {
            // Take the top suggestion
            const top = suggestions[0];
            return {
              originalQuery: query,
              found: true,
              title: top.display_name.split(',')[0].trim(),
              displayName: top.display_name,
              lat: top.lat,
              lon: top.lon,
              place_id: top.place_id
            };
          }
        } catch (error) {
          console.error(`Geocoding failed for query: "${query}"`, error);
        }

        // Return a "not found" object if geocoding fails or no suggestions
        return {
          originalQuery: query,
          found: false,
          title: query,
          displayName: 'Not found',
          lat: null,
          lon: null
        };
      }));

      return results;
    }
  };
})();
