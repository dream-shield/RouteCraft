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

      // Process queries in parallel, but handle each result individually
      const results = await Promise.all(queries.map(async (query) => {
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
