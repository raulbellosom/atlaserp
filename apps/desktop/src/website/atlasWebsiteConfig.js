import { Section }           from './blocks/Section.jsx'
import { Hero }              from './blocks/Hero.jsx'
import { Heading }           from './blocks/Heading.jsx'
import { TextBlock }         from './blocks/TextBlock.jsx'
import { ImageBlock }        from './blocks/ImageBlock.jsx'
import { CTA }               from './blocks/CTA.jsx'
import { FeatureGrid }       from './blocks/FeatureGrid.jsx'
import { FAQ }               from './blocks/FAQ.jsx'
import { ContactFormBlock }  from './blocks/ContactFormBlock.jsx'
import { BlogPostsBlock }    from './blocks/BlogPostsBlock.jsx'
import { ProductGridBlock }  from './blocks/ProductGridBlock.jsx'

export const atlasWebsiteConfig = {
  components: {
    Section:          { fields: Section.fields,          render: Section },
    Hero:             { fields: Hero.fields,             render: Hero },
    Heading:          { fields: Heading.fields,          render: Heading },
    TextBlock:        { fields: TextBlock.fields,        render: TextBlock },
    ImageBlock:       { fields: ImageBlock.fields,       render: ImageBlock },
    CTA:              { fields: CTA.fields,              render: CTA },
    FeatureGrid:      { fields: FeatureGrid.fields,      render: FeatureGrid },
    FAQ:              { fields: FAQ.fields,              render: FAQ },
    ContactFormBlock: { fields: ContactFormBlock.fields, render: ContactFormBlock },
    BlogPostsBlock:   { fields: BlogPostsBlock.fields,   render: BlogPostsBlock },
    ProductGridBlock: { fields: ProductGridBlock.fields, render: ProductGridBlock },
  },
}
