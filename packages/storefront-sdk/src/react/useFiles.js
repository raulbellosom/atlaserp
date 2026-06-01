import { useState, useCallback } from 'react'
import { useStorefront } from './context.js'

export function useFileUpload() {
  const client = useStorefront()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const upload = useCallback(async (file, options = {}) => {
    setUploading(true)
    setError(null)
    try {
      const asset = await client.files.upload(file, options)
      setResult(asset)
      return asset
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setUploading(false)
    }
  }, [client])

  const reset = useCallback(() => {
    setError(null)
    setResult(null)
  }, [])

  return { upload, uploading, error, result, reset }
}
