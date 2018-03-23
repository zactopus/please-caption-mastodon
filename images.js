const jimp = require('jimp')

function randomNumberBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const WIDTH = 339
const HEIGHT = 500

const MAX_TEXT_LENGTH = 30

function createImage (keyword, text) {
  return new Promise((resolve, reject) => {
    keyword = keyword.toLowerCase()
    
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.substring(0, MAX_TEXT_LENGTH) + '...'
    }
  
    
    const randomImage = `https://loremflickr.com/${WIDTH}/${HEIGHT}/${encodeURIComponent(keyword)}?random=${randomNumberBetween(0, 20)}`
    const defaultImage = `https://loremflickr.com/${WIDTH}/${HEIGHT}/somethingthatwouldnevercomebackwithanything`
    
    Promise.all([
      jimp.read(defaultImage),
      jimp.read(randomImage),
      jimp.read('goosebumps-cover.png'),
      jimp.loadFont(jimp.FONT_SANS_16_WHITE)
    ]).then(loadedAssets => {
      const [defaultImage, loadedImage, goosebumpsImage, font] = loadedAssets
      
      const comparisonBetweenImageAndDefaultImage = jimp.distance(defaultImage, loadedImage)
      const isDefaultImage = comparisonBetweenImageAndDefaultImage <= 0.1

      if (isDefaultImage) {
        return reject(`No image found for keyword: ${keyword} (${comparisonBetweenImageAndDefaultImage})`)
      }
      
      const huePosition = randomNumberBetween(0, 360)
      const hueRotatedCover = goosebumpsImage.color([
        { apply: 'hue', params: [huePosition] }
      ])

      const textPadMin = 30
      const textPadMax = 130
      const padPerCharacter = textPadMax / MAX_TEXT_LENGTH
      const textPosition = textPadMin + ((MAX_TEXT_LENGTH - text.length) * padPerCharacter)

      const mergedImage = loadedImage
        .composite(hueRotatedCover, 0, 0)

      const textOnImage = mergedImage
        .print(font, textPosition, HEIGHT - 47.5, text.toUpperCase(), WIDTH)

      const outputPath = 'output.' + textOnImage.getExtension()

      textOnImage.getBase64(jimp.AUTO, (error, base64OfMergedImage) => {
        if (error) {
          return reject(error)
        }

        return resolve(base64OfMergedImage)
      })
    })
    .catch(err => {
      reject(err)
    })
 })
}

module.exports = createImage