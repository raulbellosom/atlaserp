export const templateRestaurante = {
  id: 'restaurante',
  label: 'Restaurante',
  category: 'hosteleria',
  color: '#92400e',
  description: 'Sitio para restaurantes con menu, galeria y reservas.',
  pages: [
    {
      id: 'home',
      label: 'Inicio',
      routePath: '/',
      required: true,
      page: {
        schemaVersion: 1,
        id: 'page_rest_home',
        slug: '/',
        title: 'Inicio',
        visibility: 'public',
        regions: {
          main: { id: 'region_rest_main', children: ['blk_rest_nav', 'blk_rest_hero', 'blk_rest_about', 'blk_rest_features', 'blk_rest_footer'] }
        },
        blocks: {
          blk_rest_nav: {
            id: 'blk_rest_nav',
            type: 'NavbarBlock',
            props: {
              logo: 'Mi Restaurante',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Menu', href: '/menu' },
                { label: 'Galeria', href: '/galeria' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          },
          blk_rest_hero: {
            id: 'blk_rest_hero',
            type: 'HeroBlock',
            props: {
              variant: 'centered',
              title: 'Bienvenidos a nuestro restaurante',
              subtitle: 'Sabor autentico en cada plato',
              ctaLabel: 'Ver menu',
              ctaHref: '/menu'
            },
            children: {}
          },
          blk_rest_about: {
            id: 'blk_rest_about',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_rest_about',
                children: ['blk_rest_about_heading', 'blk_rest_about_text']
              }
            }
          },
          blk_rest_about_heading: {
            id: 'blk_rest_about_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Nuestra historia' },
            children: {}
          },
          blk_rest_about_text: {
            id: 'blk_rest_about_text',
            type: 'TextBlock',
            props: { text: 'Desde 1990 ofrecemos la mejor gastronomia de la region con ingredientes frescos y recetas tradicionales. Nuestro equipo de chefs expertos se dedica a crear experiencias culinarias unicas.' },
            children: {}
          },
          blk_rest_features: {
            id: 'blk_rest_features',
            type: 'SectionBlock',
            props: { paddingY: 'lg' },
            children: {
              default: {
                id: 'region_rest_features',
                children: ['blk_rest_features_heading', 'blk_rest_features_grid']
              }
            }
          },
          blk_rest_features_heading: {
            id: 'blk_rest_features_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Nuestras especialidades' },
            children: {}
          },
          blk_rest_features_grid: {
            id: 'blk_rest_features_grid',
            type: 'GridBlock',
            props: { columns: 3, gap: 'md' },
            children: {
              default: {
                id: 'region_rest_features_grid',
                children: ['blk_rest_card_1', 'blk_rest_card_2', 'blk_rest_card_3']
              }
            }
          },
          blk_rest_card_1: {
            id: 'blk_rest_card_1',
            type: 'CardBlock',
            props: { title: 'Comida tradicional', description: 'Platos clasicos con recetas heredadas desde generaciones' },
            children: {}
          },
          blk_rest_card_2: {
            id: 'blk_rest_card_2',
            type: 'CardBlock',
            props: { title: 'Ambiente acogedor', description: 'Disfruta de una atmosfera calida y acogedora con familia y amigos' },
            children: {}
          },
          blk_rest_card_3: {
            id: 'blk_rest_card_3',
            type: 'CardBlock',
            props: { title: 'Servicio excelente', description: 'Nuestro personal esta siempre listo para brindarte la mejor atencion' },
            children: {}
          },
          blk_rest_footer: {
            id: 'blk_rest_footer',
            type: 'FooterBlock',
            props: {
              companyName: 'Mi Restaurante',
              tagline: 'Sabor autentico desde 1990',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Menu', href: '/menu' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          }
        },
        seo: {
          title: 'Mi Restaurante - Inicio',
          description: 'El mejor restaurante de la ciudad con comida autentica y ambiente acogedor',
          canonical: null,
          ogImageAssetId: null
        },
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    {
      id: 'menu',
      label: 'Menu',
      routePath: '/menu',
      required: false,
      page: {
        schemaVersion: 1,
        id: 'page_rest_menu',
        slug: '/menu',
        title: 'Menu',
        visibility: 'public',
        regions: {
          main: { id: 'region_rest_menu_main', children: ['blk_rest_menu_nav', 'blk_rest_menu_hero', 'blk_rest_menu_sections', 'blk_rest_menu_footer'] }
        },
        blocks: {
          blk_rest_menu_nav: {
            id: 'blk_rest_menu_nav',
            type: 'NavbarBlock',
            props: {
              logo: 'Mi Restaurante',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Menu', href: '/menu' },
                { label: 'Galeria', href: '/galeria' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          },
          blk_rest_menu_hero: {
            id: 'blk_rest_menu_hero',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_rest_menu_hero',
                children: ['blk_rest_menu_heading']
              }
            }
          },
          blk_rest_menu_heading: {
            id: 'blk_rest_menu_heading',
            type: 'HeadingBlock',
            props: { level: 'h1', text: 'Nuestro Menu' },
            children: {}
          },
          blk_rest_menu_sections: {
            id: 'blk_rest_menu_sections',
            type: 'SectionBlock',
            props: { paddingY: 'lg' },
            children: {
              default: {
                id: 'region_rest_menu_sections',
                children: ['blk_rest_menu_entradas', 'blk_rest_menu_platos', 'blk_rest_menu_postres']
              }
            }
          },
          blk_rest_menu_entradas: {
            id: 'blk_rest_menu_entradas',
            type: 'ContainerBlock',
            props: {},
            children: {
              default: {
                id: 'region_rest_menu_entradas',
                children: ['blk_rest_menu_entradas_heading', 'blk_rest_menu_entradas_text']
              }
            }
          },
          blk_rest_menu_entradas_heading: {
            id: 'blk_rest_menu_entradas_heading',
            type: 'HeadingBlock',
            props: { level: 'h3', text: 'Entradas' },
            children: {}
          },
          blk_rest_menu_entradas_text: {
            id: 'blk_rest_menu_entradas_text',
            type: 'TextBlock',
            props: { text: 'Tabla de quesos y embutidos - Camarones al ajillo - Tabla de jamon iberico' },
            children: {}
          },
          blk_rest_menu_platos: {
            id: 'blk_rest_menu_platos',
            type: 'ContainerBlock',
            props: {},
            children: {
              default: {
                id: 'region_rest_menu_platos',
                children: ['blk_rest_menu_platos_heading', 'blk_rest_menu_platos_text']
              }
            }
          },
          blk_rest_menu_platos_heading: {
            id: 'blk_rest_menu_platos_heading',
            type: 'HeadingBlock',
            props: { level: 'h3', text: 'Platos principales' },
            children: {}
          },
          blk_rest_menu_platos_text: {
            id: 'blk_rest_menu_platos_text',
            type: 'TextBlock',
            props: { text: 'Filete a la parrilla - Salmon a la mantequilla - Paella tradicional - Costillas BBQ' },
            children: {}
          },
          blk_rest_menu_postres: {
            id: 'blk_rest_menu_postres',
            type: 'ContainerBlock',
            props: {},
            children: {
              default: {
                id: 'region_rest_menu_postres',
                children: ['blk_rest_menu_postres_heading', 'blk_rest_menu_postres_text']
              }
            }
          },
          blk_rest_menu_postres_heading: {
            id: 'blk_rest_menu_postres_heading',
            type: 'HeadingBlock',
            props: { level: 'h3', text: 'Postres' },
            children: {}
          },
          blk_rest_menu_postres_text: {
            id: 'blk_rest_menu_postres_text',
            type: 'TextBlock',
            props: { text: 'Flan casero - Tiramisú - Helado artesanal - Brownie con chocolate caliente' },
            children: {}
          },
          blk_rest_menu_footer: {
            id: 'blk_rest_menu_footer',
            type: 'FooterBlock',
            props: {
              companyName: 'Mi Restaurante',
              tagline: 'Sabor autentico desde 1990'
            },
            children: {}
          }
        },
        seo: {
          title: 'Menu - Mi Restaurante',
          description: 'Descubre nuestro menu con platos tradicionales y especialidades',
          canonical: null,
          ogImageAssetId: null
        },
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    {
      id: 'galeria',
      label: 'Galeria',
      routePath: '/galeria',
      required: false,
      page: {
        schemaVersion: 1,
        id: 'page_rest_galeria',
        slug: '/galeria',
        title: 'Galeria',
        visibility: 'public',
        regions: {
          main: { id: 'region_rest_galeria_main', children: ['blk_rest_gal_nav', 'blk_rest_gal_hero', 'blk_rest_gal_content', 'blk_rest_gal_footer'] }
        },
        blocks: {
          blk_rest_gal_nav: {
            id: 'blk_rest_gal_nav',
            type: 'NavbarBlock',
            props: {
              logo: 'Mi Restaurante',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Menu', href: '/menu' },
                { label: 'Galeria', href: '/galeria' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          },
          blk_rest_gal_hero: {
            id: 'blk_rest_gal_hero',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_rest_gal_hero',
                children: ['blk_rest_gal_heading']
              }
            }
          },
          blk_rest_gal_heading: {
            id: 'blk_rest_gal_heading',
            type: 'HeadingBlock',
            props: { level: 'h1', text: 'Galeria de fotos' },
            children: {}
          },
          blk_rest_gal_content: {
            id: 'blk_rest_gal_content',
            type: 'SectionBlock',
            props: { paddingY: 'lg' },
            children: {
              default: {
                id: 'region_rest_gal_content',
                children: ['blk_rest_gal_grid']
              }
            }
          },
          blk_rest_gal_grid: {
            id: 'blk_rest_gal_grid',
            type: 'GridBlock',
            props: { columns: 3, gap: 'md' },
            children: {
              default: {
                id: 'region_rest_gal_grid',
                children: ['blk_rest_gal_img_1', 'blk_rest_gal_img_2', 'blk_rest_gal_img_3', 'blk_rest_gal_img_4', 'blk_rest_gal_img_5', 'blk_rest_gal_img_6']
              }
            }
          },
          blk_rest_gal_img_1: {
            id: 'blk_rest_gal_img_1',
            type: 'ImageBlock',
            props: { src: '', alt: 'Plato delicioso 1' },
            children: {}
          },
          blk_rest_gal_img_2: {
            id: 'blk_rest_gal_img_2',
            type: 'ImageBlock',
            props: { src: '', alt: 'Plato delicioso 2' },
            children: {}
          },
          blk_rest_gal_img_3: {
            id: 'blk_rest_gal_img_3',
            type: 'ImageBlock',
            props: { src: '', alt: 'Plato delicioso 3' },
            children: {}
          },
          blk_rest_gal_img_4: {
            id: 'blk_rest_gal_img_4',
            type: 'ImageBlock',
            props: { src: '', alt: 'Ambiente del restaurante 1' },
            children: {}
          },
          blk_rest_gal_img_5: {
            id: 'blk_rest_gal_img_5',
            type: 'ImageBlock',
            props: { src: '', alt: 'Ambiente del restaurante 2' },
            children: {}
          },
          blk_rest_gal_img_6: {
            id: 'blk_rest_gal_img_6',
            type: 'ImageBlock',
            props: { src: '', alt: 'Nuestro equipo' },
            children: {}
          },
          blk_rest_gal_footer: {
            id: 'blk_rest_gal_footer',
            type: 'FooterBlock',
            props: {
              companyName: 'Mi Restaurante',
              tagline: 'Sabor autentico desde 1990'
            },
            children: {}
          }
        },
        seo: {
          title: 'Galeria - Mi Restaurante',
          description: 'Mira nuestros platos y ambiente en fotos',
          canonical: null,
          ogImageAssetId: null
        },
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    {
      id: 'contacto',
      label: 'Contacto',
      routePath: '/contacto',
      required: false,
      page: {
        schemaVersion: 1,
        id: 'page_rest_contacto',
        slug: '/contacto',
        title: 'Contacto',
        visibility: 'public',
        regions: {
          main: { id: 'region_rest_contacto_main', children: ['blk_rest_cont_nav', 'blk_rest_cont_hero', 'blk_rest_cont_info', 'blk_rest_cont_footer'] }
        },
        blocks: {
          blk_rest_cont_nav: {
            id: 'blk_rest_cont_nav',
            type: 'NavbarBlock',
            props: {
              logo: 'Mi Restaurante',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Menu', href: '/menu' },
                { label: 'Galeria', href: '/galeria' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          },
          blk_rest_cont_hero: {
            id: 'blk_rest_cont_hero',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_rest_cont_hero',
                children: ['blk_rest_cont_heading']
              }
            }
          },
          blk_rest_cont_heading: {
            id: 'blk_rest_cont_heading',
            type: 'HeadingBlock',
            props: { level: 'h1', text: 'Contactanos' },
            children: {}
          },
          blk_rest_cont_info: {
            id: 'blk_rest_cont_info',
            type: 'SectionBlock',
            props: { paddingY: 'lg' },
            children: {
              default: {
                id: 'region_rest_cont_info',
                children: ['blk_rest_cont_info_heading', 'blk_rest_cont_info_cols']
              }
            }
          },
          blk_rest_cont_info_heading: {
            id: 'blk_rest_cont_info_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Informacion de contacto' },
            children: {}
          },
          blk_rest_cont_info_cols: {
            id: 'blk_rest_cont_info_cols',
            type: 'ColumnsBlock',
            props: { columns: 2, gap: 'lg' },
            children: {
              default: {
                id: 'region_rest_cont_info_cols',
                children: ['blk_rest_cont_phone', 'blk_rest_cont_address']
              }
            }
          },
          blk_rest_cont_phone: {
            id: 'blk_rest_cont_phone',
            type: 'CardBlock',
            props: { title: 'Telefono', description: '+34 912 345 678' },
            children: {}
          },
          blk_rest_cont_address: {
            id: 'blk_rest_cont_address',
            type: 'CardBlock',
            props: { title: 'Direccion', description: 'Calle Principal 123, Ciudad 28001, Espana' },
            children: {}
          },
          blk_rest_cont_footer: {
            id: 'blk_rest_cont_footer',
            type: 'FooterBlock',
            props: {
              companyName: 'Mi Restaurante',
              tagline: 'Sabor autentico desde 1990'
            },
            children: {}
          }
        },
        seo: {
          title: 'Contacto - Mi Restaurante',
          description: 'Ponte en contacto con nosotros',
          canonical: null,
          ogImageAssetId: null
        },
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    }
  ]
}
