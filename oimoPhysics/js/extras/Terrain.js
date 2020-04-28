function Terrain( o, mat ) {

    o = o == undefined ? {} : o;

    this.uvx = [18,18];

    this.sample = o.sample == undefined ? [64,64] : o.sample;
    this.size = o.size == undefined ? [100,10,100] : o.size;

    this.data = {
        level: o.level || [1,0.2,0.05],
        frequency: o.frequency || [0.016,0.05,0.2],
        expo: o.expo || 1,
    }

    this.isWater = o.water || false;

    this.colorBase = this.isWater ? { r:0, g:0.7, b:1 } : { r:1, g:0.7, b:0 };

    this.maxspeed = 1;
    this.acc = 0.01;
    this.dec = 0.01;

    this.ease = new THREE.Vector2();

    // for perlin
    this.complexity = o.complexity == undefined ? 30 : o.complexity;
    this.complexity2 = o.complexity2 == undefined ? null : o.complexity2;

    this.local = new THREE.Vector3();
    if(o.local) this.local.fromArray( o.local );

    this.pp = new THREE.Vector3();

    this.lng = this.sample[0] * this.sample[1];
    this.heightData = new Float64Array( this.lng );
    this.height = [];

    this.colors = new Float32Array( this.lng * 3 );
    this.geometry = new THREE.PlaneBufferGeometry( this.size[0], this.size[2], this.sample[0] - 1, this.sample[1] - 1 );
    this.geometry.rotateX( -Math.PI90 );
    this.geometry.computeBoundingSphere();

    this.geometry.addAttribute( 'color', new THREE.BufferAttribute( this.colors, 3 ) );
    this.vertices = this.geometry.attributes.position.array;

    this.wn = null;
    if(this.isWater){
        this.wn = view.loadTexture('terrain/water_n.jpg')
        this.wn.repeat = new THREE.Vector2( 3, 3 );
        this.wn.wrapS = THREE.RepeatWrapping;
        this.wn.wrapT = THREE.RepeatWrapping;
    }

    this.material = new THREE.MeshStandardMaterial({ 
        vertexColors: THREE.VertexColors, 
        name:'terrain', 
        metalness:this.isWater? 0.8 : 0.05, 
        roughness:this.isWater? 0.2 : 0.7, 
        //wireframe:true, 
        envMap: view.getEnvMap(),
        normalMap:this.wn,
        normalScale:this.isWater?  new THREE.Vector2(0.25,0.25):new THREE.Vector2(2,2),
    });

    var map = [
        '#ifdef USE_MAP',

            'float slope = vColor.r;',
            'vec4 baseColor = vec4(1.0);',

            'vec4 sand = mapTexelToLinear( texture2D( map, vUv ) );',
            'vec4 grass = mapTexelToLinear( texture2D( emissiveMap, vUv ) );',
            'vec4 rock = mapTexelToLinear( texture2D( alphaMap, vUv ) );',

            'if (slope < .5) baseColor = grass;',
            'if (slope > .8) baseColor = rock;',
            'if ((slope<.8) && (slope >= .5)) baseColor = mix( grass , rock, (slope - .5) * (1. / (.8 - .5)));',
            'if (slope < .2) baseColor = mix( sand, grass, slope * (1.0/0.2) );',
            'diffuseColor *= baseColor;',
        '#endif',
    ];

    var normal = [
        '#ifdef FLAT_SHADED',
        'vec3 fdx = vec3( dFdx( vViewPosition.x ), dFdx( vViewPosition.y ), dFdx( vViewPosition.z ) );',
        'vec3 fdy = vec3( dFdy( vViewPosition.x ), dFdy( vViewPosition.y ), dFdy( vViewPosition.z ) );',
        'vec3 normal = normalize( cross( fdx, fdy ) );',
        '#else',
        '    vec3 normal = normalize( vNormal );',
        '#endif',
        '#ifdef USE_NORMALMAP',
            'vec4 extraNormal = vec4(1.0);',
            'vec4 sandN =  texture2D( normalMap, vUv );',
            'vec4 grassN = texture2D( roughnessMap, vUv );',
            'vec4 rockN = texture2D( metalnessMap, vUv );',
            'float slopeN = vColor.r;',

            'if (slopeN < .5) extraNormal = grassN;',
            'if (slopeN > .8) extraNormal = rockN;',
            'if ((slopeN<.8) && (slopeN >= .5)) extraNormal = mix( grassN , rockN, (slopeN - .5) * (1. / (.8 - .5)));',
            'if (slopeN < .2) extraNormal = mix( sandN, grassN, slopeN * (1.0/0.2) );',
            'normal = perturbNormal2Arb( extraNormal.xyz, -vViewPosition, normal );',
    
        '#endif',
    ];

    var normal_part = [
        '#ifdef USE_NORMALMAP',

        'uniform sampler2D normalMap;',
        'uniform vec2 normalScale;',

        // Per-Pixel Tangent Space Normal Mapping
        // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html

        'vec3 perturbNormal2Arb( vec3 n_color, vec3 eye_pos, vec3 surf_norm ) {',

            // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988

            'vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );',
            'vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );',
            'vec2 st0 = dFdx( vUv.st );',
            'vec2 st1 = dFdy( vUv.st );',

            'vec3 S = normalize( q0 * st1.t - q1 * st0.t );',
            'vec3 T = normalize( -q0 * st1.s + q1 * st0.s );',
            'vec3 N = normalize( surf_norm );',

            'vec3 mapN = n_color * 2.0 - 1.0;',
            'mapN.xy = normalScale * mapN.xy;',
            'mat3 tsn = mat3( S, T, N );',
            'return normalize( tsn * mapN );',

        '}',

        '#endif',
    ];

    if(!this.isWater){

        //this.sand = view.loadTexture('terrain/sand.jpg');

        this.material.map = view.loadTexture('terrain/sand.jpg');

        this.material.map.repeat = new THREE.Vector2( this.uvx[0], this.uvx[1] );
        this.material.map.wrapS = THREE.RepeatWrapping;
        this.material.map.wrapT = THREE.RepeatWrapping;
        this.material.emissiveMap = view.loadTexture('terrain/grass.jpg');
        this.material.emissiveMap.wrapS = THREE.RepeatWrapping;
        this.material.emissiveMap.wrapT = THREE.RepeatWrapping;
        this.material.alphaMap = view.loadTexture('terrain/rock.jpg');
        this.material.alphaMap.wrapS = THREE.RepeatWrapping;
        this.material.alphaMap.wrapT = THREE.RepeatWrapping;

        this.material.normalMap = view.loadTexture('terrain/sand_n.jpg');
        this.material.normalMap.repeat = new THREE.Vector2( this.uvx[0], this.uvx[1] );
        this.material.normalMap.wrapS = THREE.RepeatWrapping;
        this.material.normalMap.wrapT = THREE.RepeatWrapping;
        this.material.roughnessMap = view.loadTexture('terrain/grass_n.jpg');
        this.material.roughnessMap.wrapS = THREE.RepeatWrapping;
        this.material.roughnessMap.wrapT = THREE.RepeatWrapping;
        this.material.metalnessMap = view.loadTexture('terrain/rock_n.jpg');
        this.material.metalnessMap.wrapS = THREE.RepeatWrapping;
        this.material.metalnessMap.wrapT = THREE.RepeatWrapping;

        this.material.onBeforeCompile = function ( shader ) {
            var vertex = shader.vertexShader;
            var fragment = shader.fragmentShader;

            fragment = fragment.replace( '#include <normalmap_pars_fragment>', normal_part.join("\n") );

            fragment = fragment.replace( '#include <map_fragment>', map.join("\n") );
            fragment = fragment.replace( '#include <normal_fragment>', normal.join("\n") );
            fragment = fragment.replace( '#include <alphamap_fragment>', '' );
            fragment = fragment.replace( '#include <color_fragment>', '' );
            fragment = fragment.replace( '#include <emissivemap_fragment>', '' );

            fragment = fragment.replace( '#include <aomap_fragment>', '' );
            fragment = fragment.replace( '#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;' );
            fragment = fragment.replace( '#include <metalnessmap_fragment>', 'float metalnessFactor = metalness;' );
            shader.fragmentShader = fragment;
            return shader;
        }
    }

    this.update();

    THREE.Mesh.call( this, this.geometry, this.material );

    this.castShadow = false;
    this.receiveShadow = true;

};

Terrain.prototype = Object.assign( Object.create( THREE.Mesh.prototype ), {

    constructor: Terrain,

    dispose: function () {

        this.geometry.dispose();
        this.material.dispose();
        
    },

    easing: function () {

        var key = user.key;
        var r = -view.getControls().getAzimuthalAngle();

        if( key[7] ) this.maxspeed = 1.5;
        else this.maxspeed = 0.25;

        //acceleration
        this.ease.y += key[1] * this.acc; // up down
        this.ease.x += key[0] * this.acc; // left right
        //speed limite
        this.ease.x = this.ease.x > this.maxspeed ? this.maxspeed : this.ease.x;
        this.ease.x = this.ease.x < -this.maxspeed ? -this.maxspeed : this.ease.x;
        this.ease.y = this.ease.y > this.maxspeed ? this.maxspeed : this.ease.y;
        this.ease.y = this.ease.y < -this.maxspeed ? -this.maxspeed : this.ease.y;

        //break
        if (!key[1]) {
            if (this.ease.y > this.dec) this.ease.y -= this.dec;
            else if (this.ease.y < -this.dec) this.ease.y += this.dec;
            else this.ease.y = 0;
        }
        if (!key[0]) {
            if (this.ease.x > this.dec) this.ease.x -= this.dec;
            else if (this.ease.x < -this.dec) this.ease.x += this.dec;
            else this.ease.x = 0;
        }

        if ( !this.ease.x && !this.ease.y ) return;

        this.local.z += Math.sin(r) * this.ease.x + Math.cos(r) * this.ease.y;
        this.local.x += Math.cos(r) * this.ease.x - Math.sin(r) * this.ease.y;

        this.update();

    },

    getHeight: function ( x, z ) {

        return this.height[ this.findId( x, z ) ] * this.size[ 1 ];

    },

    findId: function( x, z ){

        return x+(z*this.sample[1]);

    },

    update: function () {

        if( this.isWater ){ 
            this.wn.offset.x+=0.002;
            this.wn.offset.y+=0.001;
        } else {
            this.material.map.offset.x = this.local.x * ( 1.0 / (this.size[0]/ this.uvx[0]));
            this.material.map.offset.y = - this.local.z * ( 1.0 / (this.size[2]/this.uvx[1]));
        }

   

        var v = this.pp;
        var r = 1 / this.sample[0];
        var sx = this.sample[0] - 1;
        var sz = this.sample[1] - 1;
        var rx = sx / this.size[0];
        var rz = sz / this.size[2];
        var cc = [1,1,1];

        var i = this.lng, n, x, y, yr, c, l=0;//, c, d, e, l;
        while(i--){
            n = i * 3;
            x = i % this.sample[0];
            y = Math.floor( i * r );
            yr = sz - y;

            v.set( x+(this.local.x*rx), this.local.y, y+(this.local.z*rz) );

            c = Math.noise( v, this.data );

            //c = Math.quinticSCurve(c);
            //c = Math.cubicSCurve(c)
            //c = Math.linear(c,0.2, 1);
            //c = Math.clamp(c,0.2,1)

            c = Math.pow(c, this.data.expo);

            c = c>1 ? 1:c;
            c = c<0 ? 0:c;
            
            this.height[ i ] = c;
            this.heightData[ this.findId( x, yr ) ] = c;// 0 to 1
            this.vertices[ n + 1 ] = c * this.size[ 1 ];

            /*vv.set(this.vertices[ n ], this.vertices[ n + 1 ], this.vertices[ n + 2 ])
            l = vv.normalize().dot(sun);
            l = l>1 ? 1:l;
            l = l<0 ? 0:l;*/


            if(this.isWater){

                cc = [ c * this.colorBase.r, c * this.colorBase.g, c * this.colorBase.b ];

            } else {

                cc = [ c, 0, 0];

            }



            this.colors[ n ] = cc[0];
            this.colors[ n + 1 ] = cc[1];
            this.colors[ n + 2 ] = cc[2];
            

        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        
        //this.geometry.computeBoundingSphere();
        this.geometry.computeVertexNormals();


    }

});