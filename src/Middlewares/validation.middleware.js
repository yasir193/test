export const validateJson = (req, res, next) => {
  if (!req.body.jsonData) {
    return res.status(400).json({
      status: 'error',
      message: 'JSON data is required'
    });
  }

  try {
    
    if (typeof req.body.jsonData === 'string') {
      req.body.jsonData = JSON.parse(req.body.jsonData);
    }
    next();
  } catch (err) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid JSON format',
      details: err.message
    });
  }
};